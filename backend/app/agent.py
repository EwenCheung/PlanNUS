import os
import json
from typing import List, Dict, Any, Optional
from openai import OpenAI
from app.supabase_client import get_supabase
from app.models import Module
from app.core import evaluate_prereq_tree, assign_to_semesters, Course

class CoursePlanningAgent:
    def __init__(self):
        self.client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        self.supabase = get_supabase()
        self.model = "gpt-4o" 

    def search_modules(self, query: str, limit: int = 5) -> List[Dict]:
        """Search modules using vector similarity (RAG)."""
        try:
            # 1. Generate embedding for query
            response = self.client.embeddings.create(
                input=query,
                model="text-embedding-3-small"
            )
            embedding = response.data[0].embedding
            
            # 2. Call Supabase RPC function for vector search
            res = self.supabase.rpc("match_modules", {
                "query_embedding": embedding,
                "match_threshold": 0.3, # Filters out irrelevant results
                "match_count": limit
            }).execute()
            
            return res.data
            
        except Exception as e:
            # Fallback to simple keyword search if RAG fails (e.g. function not created yet)
            print(f"Vector search failed ({str(e)}), falling back to keyword search.")
            res = self.supabase.table("modules") \
                .select("module_code, title, description, module_credit") \
                .ilike("title", f"%{query}%") \
                .limit(limit) \
                .execute()
                
            return res.data

    def get_module_details(self, module_code: str) -> Dict:
        """Fetch full module details."""
        res = self.supabase.table("modules").select("*").eq("module_code", module_code).single().execute()
        return res.data if res.data else {}

    def check_prerequisites(self, module_code: str, taken_modules: List[str]) -> Dict:
        """Check if prerequisites are met using core.py logic."""
        module = self.get_module_details(module_code)
        if not module:
            return {"valid": False, "error": "Module not found"}
        
        # Use core.py's robust tree evaluation
        tree = module.get("prerequisite_tree")
        is_valid = evaluate_prereq_tree(tree, set(taken_modules))
        
        return {
            "valid": is_valid,
            "prereq_tree": tree
        }
        
    def validate_study_plan(self, plan: Dict) -> List[str]:
        """
        Validate the semester-by-semester plan using a simplified check.
        plan format: {"y1s1": ["CS1101S"], "y1s2": [...]}
        """
        warnings = []
        taken = set()
        
        # Sort semesters chronologically to verify sequence
        # Assuming keys are like "y1s1", "y1s2", etc.
        sems = sorted(plan.keys()) 
        
        for sem in sems:
            modules = plan[sem]
            for code in modules:
                # Check prereqs against previously taken
                check = self.check_prerequisites(code, list(taken))
                if not check["valid"]:
                    warnings.append(f"Warning: {code} in {sem} is missing prerequisites.")
                
                taken.add(code)
                
        return warnings

    def get_degree_requirements(self, major: str) -> Dict:
        """
        Fetch degree requirements and important notes for a major.
        """
        try:
            # Case-insensitive match for major
            res = self.supabase.table("degree_requirements") \
                .select("*") \
                .ilike("major", f"%{major}%") \
                .limit(1) \
                .execute()
            
            if res.data:
                return res.data[0]
            return {"error": "Major not found"}
        except Exception as e:
            return {"error": str(e)}

    def get_module_reviews(self, module_code: str) -> Dict:
        """
        Fetch reviews and sentiment summary for a module.
        """
        try:
            # Get reviews
            reviews_res = self.supabase.table("reviews") \
                .select("comment, rating, timestamp") \
                .eq("module_code", module_code) \
                .order("timestamp", desc=True) \
                .limit(5) \
                .execute()
            
            # Get summary from module table
            mod_res = self.supabase.table("modules") \
                .select("sentiment_tags, attributes") \
                .eq("module_code", module_code) \
                .single() \
                .execute()
                
            summary = ""
            tags = []
            if mod_res.data:
                tags = mod_res.data.get("sentiment_tags", [])
                attrs = mod_res.data.get("attributes", {})
                if attrs:
                    summary = attrs.get("sentiment_summary", "")

            return {
                "reviews": reviews_res.data,
                "sentiment_summary": summary,
                "sentiment_tags": tags
            }
        except Exception as e:
            return {"error": str(e)}

    def query_database(self, question: str) -> Dict:
        """
        Text-to-SQL: Generate and execute a safe SQL query based on natural language.
        Only allows SELECT queries on specific tables.
        """
        # Define allowed tables and their schemas for the LLM
        schema_info = """
Available tables:
1. modules (module_code TEXT PK, title TEXT, description TEXT, module_credit INT, prerequisite TEXT, preclusion TEXT, faculty TEXT, department TEXT, workload TEXT, attributes JSONB, sentiment_tags TEXT[], review_summary TEXT)
2. offerings (id SERIAL PK, module_code TEXT FK, acad_year TEXT, semester INT)
3. reviews (id SERIAL PK, module_code TEXT FK, rating INT, comment TEXT, timestamp TIMESTAMP)
4. degree_requirements (id SERIAL PK, degree TEXT, major TEXT, courses JSONB, notes TEXT, total_units INT)
5. plans (id UUID PK, user_id UUID FK, name TEXT, data JSONB, created_at TIMESTAMP)

Important columns:
- modules.attributes contains JSON with workload info
- modules.sentiment_tags is an array of strings like ['heavy workload', 'great prof']
- modules.review_summary is AI-generated summary of reviews
- degree_requirements.courses contains structured JSON with core, focusArea, commonCore, unrestrictedElectives
"""
        
        try:
            # Use LLM to generate SQL
            sql_response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": f"""You are a SQL query generator for a NUS module planning database.
{schema_info}

Rules:
1. ONLY generate SELECT queries (no INSERT, UPDATE, DELETE, DROP, etc.)
2. ONLY query the tables listed above
3. Use ILIKE for case-insensitive text matching
4. LIMIT results to at most 20 rows
5. Return ONLY the SQL query, no explanation

If the question cannot be answered with a safe SELECT query, respond with: UNSAFE_QUERY"""},
                    {"role": "user", "content": f"Generate a SQL query to answer: {question}"}
                ],
                max_tokens=500,
                temperature=0
            )
            
            sql_query = sql_response.choices[0].message.content.strip()
            
            # Safety checks
            sql_upper = sql_query.upper()
            if "UNSAFE_QUERY" in sql_query:
                return {"error": "Cannot generate a safe query for this question"}
            
            if any(keyword in sql_upper for keyword in ["INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "ALTER", "CREATE", "GRANT", "REVOKE"]):
                return {"error": "Only SELECT queries are allowed"}
            
            if not sql_upper.strip().startswith("SELECT"):
                return {"error": "Query must start with SELECT"}
            
            # Execute query via Supabase RPC (requires a custom function) or use direct connection
            # For safety, we'll use Supabase's from_() with raw SQL limitations
            # Actually, Supabase Python client doesn't support raw SQL directly
            # We'll need to parse and use the query builder, or create an RPC function
            
            # For now, let's use a simple approach - execute via Supabase postgREST
            # Since raw SQL isn't directly supported, we'll return the generated query
            # and have the agent interpret the intent
            
            # Attempt to execute using table-specific queries based on intent
            if "modules" in sql_upper and "WHERE" in sql_upper:
                # Try to extract a simple condition
                if "module_code" in sql_query.lower():
                    # Simple module lookup
                    import re
                    match = re.search(r"module_code\s*(?:=|ILIKE)\s*'([^']+)'", sql_query, re.IGNORECASE)
                    if match:
                        code = match.group(1).replace('%', '')
                        res = self.supabase.table("modules") \
                            .select("module_code, title, description, module_credit, faculty, workload") \
                            .ilike("module_code", f"%{code}%") \
                            .limit(10) \
                            .execute()
                        return {"success": True, "sql": sql_query, "results": res.data, "count": len(res.data), "formatted_table": self.format_results_as_table(res.data)}
            
            if "degree_requirements" in sql_upper:
                # Degree requirements query
                import re
                match = re.search(r"major\s*ILIKE\s*'%([^%]+)%'", sql_query, re.IGNORECASE)
                if match:
                    major = match.group(1)
                    res = self.supabase.table("degree_requirements") \
                        .select("*") \
                        .ilike("major", f"%{major}%") \
                        .limit(5) \
                        .execute()
                    return {"success": True, "sql": sql_query, "results": res.data, "count": len(res.data)}
            
            if "reviews" in sql_upper:
                # Reviews query
                import re
                match = re.search(r"module_code\s*=\s*'([^']+)'", sql_query, re.IGNORECASE)
                if match:
                    code = match.group(1)
                    res = self.supabase.table("reviews") \
                        .select("*") \
                        .eq("module_code", code) \
                        .limit(10) \
                        .execute()
                    return {"success": True, "sql": sql_query, "results": res.data, "count": len(res.data), "formatted_table": self.format_results_as_table(res.data)}
            
            if "offerings" in sql_upper:
                # Offerings query
                import re
                match = re.search(r"module_code\s*=\s*'([^']+)'", sql_query, re.IGNORECASE)
                if match:
                    code = match.group(1)
                    res = self.supabase.table("offerings") \
                        .select("*") \
                        .eq("module_code", code) \
                        .limit(20) \
                        .execute()
                    return {"success": True, "sql": sql_query, "results": res.data, "count": len(res.data), "formatted_table": self.format_results_as_table(res.data)}
            
            # For complex queries, return error with helpful suggestions
            return {
                "success": False,
                "sql": sql_query, 
                "error": "Could not execute this complex query directly.",
                "suggestion": "Try using these tools instead: search_modules (for finding modules), get_degree_requirements (for graduation requirements), get_module_reviews (for reviews/ratings)",
                "results": []
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Query failed: {str(e)}",
                "suggestion": "Please try: search_modules, get_degree_requirements, or get_module_reviews instead"
            }
    
    def format_results_as_table(self, results: List[Dict], max_rows: int = 10) -> str:
        """Format query results as a markdown table for display."""
        if not results:
            return "No results found."
        
        # Get columns from first result
        columns = list(results[0].keys())[:5]  # Limit to 5 columns for readability
        
        # Build header
        header = "| " + " | ".join(columns) + " |"
        separator = "| " + " | ".join(["---"] * len(columns)) + " |"
        
        # Build rows
        rows = []
        for row in results[:max_rows]:
            values = [str(row.get(col, ""))[:30] for col in columns]  # Truncate long values
            rows.append("| " + " | ".join(values) + " |")
        
        table = f"{header}\n{separator}\n" + "\n".join(rows)
        
        if len(results) > max_rows:
            table += f"\n\n*...and {len(results) - max_rows} more results*"
        
        return table

    def process_chat(self, user_id: str, message: str, current_plan: Dict, user_major: str = "Undeclared", user_degree: str = "Undeclared", current_semester: str = "Y1S1", start_year: str = "2024/2025", has_exchange: bool = False, conversation_history: List[Dict] = None, conversation_summary: str = "") -> Dict:
        """
        Main entry point for Chat.
        """
        # Build messages with system prompt first
        summary_context = f"\n## Earlier Conversation Summary\n{conversation_summary}" if conversation_summary else ""
        
        messages = [
            {"role": "system", "content": f"""
You are Steve, a friendly academic advisor for NUS. Be CONCISE and HELPFUL.

## Student Profile
- **Degree**: {user_degree}
- **Major**: {user_major}
- **Current Semester**: {current_semester}
- **Start Year**: {start_year}
- **Exchange Planned**: {"Yes" if has_exchange else "No"}

## CRITICAL: Response Style
1. **Be CONCISE** - Give short, focused answers (2-4 sentences max for simple questions)
2. **ASK before dumping info** - If the question is broad, ask clarifying questions first
3. **Only answer what's asked** - Don't list all requirements unless specifically asked
4. **Use simple formatting** - Bullet points > tables for short lists

## Degree Requirements Data Structure (from get_degree_requirements tool)
When you call get_degree_requirements, the "courses" field contains JSON with:
- **core**: Core modules (CS Foundation, Math & Sciences, Breadth & Depth)
- **focusArea**: Focus area options (AI, Security, SE, etc.) with primaryOptions and electiveOptions
- **commonCore**: "Fluff" modules (easier general education modules):
  - University Level Requirements (Digital Literacy, Cultures & Connections, etc.)
  - Computing Ethics (IS1108)
  - **Interdisciplinary (ID)**: 8 units from specific ID options listed
  - **Cross-Disciplinary (CD)**: 4 units from specific CD options listed
- **unrestrictedElectives (UE)**: 40 units of any modules

## Key Terms Students Ask About
- **Fluff mods** = Common Core modules (GE modules, IS1108, ES2660) - easier, non-major
- **Core mods** = CS Foundation modules (CS1231S, CS2030S, CS2040S, etc.)
- **ID mods** = Interdisciplinary - check commonCore.categories for "Interdisciplinary Courses" options
- **CD mods** = Cross-Disciplinary - check commonCore.categories for "Cross-Disciplinary Courses" options
- **Focus Area** = Specialization track (AI, Security, SE, etc.) - check focusArea.options
- **UE** = Unrestricted Electives - can be any module

## When to use tools
- Use `get_degree_requirements` when asked about fluff/core/ID/CD/focus areas/requirements
- Use `search_modules` when asked to find specific topics or module codes
- Use `get_module_reviews` when asked about workload/difficulty

## Current Plan Summary
{json.dumps(current_plan, indent=2) if current_plan else "No modules planned yet"}
{summary_context}
"""}
        ]
        
        # Add conversation history for memory (if provided)
        if conversation_history:
            for msg in conversation_history[:-1]:  # Exclude current message (added below)
                messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
        
        # Add current user message
        messages.append({"role": "user", "content": message})
        
        # Tool Definitions
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "search_modules",
                    "description": "Search for NUS modules by keywords",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string"}
                        },
                        "required": ["query"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "check_prerequisites",
                    "description": "Check if a student meets prerequisites for a module",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "module_code": {"type": "string"},
                            "taken_modules": {"type": "array", "items": {"type": "string"}}
                        },
                        "required": ["module_code", "taken_modules"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_degree_requirements",
                    "description": "Get degree requirements for a major. Returns structured JSON with: core (CS Foundation modules), focusArea (AI, Security, SE options with primary/elective modules), commonCore (fluff modules including ID/CD options list), and unrestrictedElectives. Use this for questions about fluff, core, ID, CD, focus areas, or graduation requirements.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "major": {"type": "string", "description": "The major name, e.g. 'Computer Science'"}
                        },
                        "required": ["major"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_module_reviews",
                    "description": "Get student reviews, sentiment summary, and tags for a module",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "module_code": {"type": "string"}
                        },
                        "required": ["module_code"]
                    }
                }
            },
             {
                "type": "function",
                "function": {
                    "name": "suggest_plan_modification",
                    "description": "Suggest a structured modification to the study plan. Use this when user explicitly asks to change/add/remove/move modules.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "action": {"type": "string", "enum": ["add", "remove", "move", "swap"]},
                            "target_module": {"type": "string"},
                            "replacement_module": {"type": "string", "description": "Required for swap"},
                            "target_semester": {"type": "string", "description": "Required for move/add, e.g. 'y1s1'"}
                        },
                        "required": ["action", "target_module"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "query_database",
                    "description": "Query the database with natural language. Use this for complex questions that other tools can't answer, like 'how many 4-credit CS modules are there?' or 'which modules have the highest ratings?'. Generates and executes safe SQL queries.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "question": {"type": "string", "description": "Natural language question about the database"}
                        },
                        "required": ["question"]
                    }
                }
            }
        ]
        
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            tools=tools
        )
        
        msg = response.choices[0].message
        
        # Tool Execution Loop
        if msg.tool_calls:
            # Check if it's a UI action (plan modification) -> Return immediately for Frontend
            for tool_call in msg.tool_calls:
                 if tool_call.function.name == "suggest_plan_modification":
                     return {
                         "role": "assistant",
                         "content": msg.content, # Might be null/empty if just calling tool
                         "tool_calls": [tool_call.model_dump()]
                     }
            
            # Use a limited loop to handle read-only tools (search, check)
            # We append the tool call and result to history and ask LLM again
            messages.append(msg)
            
            for tool_call in msg.tool_calls:
                func_name = tool_call.function.name
                args = json.loads(tool_call.function.arguments)
                result = None
                
                try:
                    if func_name == "search_modules":
                        result = self.search_modules(args["query"])
                    elif func_name == "check_prerequisites":
                        result = self.check_prerequisites(args["module_code"], args["taken_modules"])
                    elif func_name == "get_degree_requirements":
                        result = self.get_degree_requirements(args["major"])
                    elif func_name == "get_module_reviews":
                        result = self.get_module_reviews(args["module_code"])
                    elif func_name == "query_database":
                        result = self.query_database(args["question"])
                    elif func_name == "validate_study_plan":
                         pass
                    
                    # Append result
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": json.dumps(result or {"error": "Tool not implemented"})
                    })
                    
                except Exception as e:
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": json.dumps({"error": str(e)})
                    })
            
            # Second call to get the final answer based on tool outputs
            second_response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=tools
            )
            return {
                "role": "assistant",
                "content": second_response.choices[0].message.content,
                "tool_calls": None # We handled them
            }

        return {
            "role": "assistant",
            "content": msg.content,
            "tool_calls": None
        }