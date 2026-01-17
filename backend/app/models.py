from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship, Column, JSON
from pgvector.sqlalchemy import Vector
from uuid import UUID, uuid4

# Shared properties
class ModuleBase(SQLModel):
    module_code: str = Field(primary_key=True, index=True)
    title: str
    description: Optional[str] = None
    module_credit: float
    department: str
    faculty: str
    workload: List[float] = Field(default=[], sa_column=Column(JSON))
    prerequisite_rule: Optional[str] = None
    prerequisite_tree: Optional[Dict] = Field(default=None, sa_column=Column(JSON))
    preclusion: Optional[str] = None
    attributes: Optional[Dict] = Field(default=None, sa_column=Column(JSON))
    sentiment_tags: Optional[List[str]] = Field(default=[], sa_column=Column(JSON))
    review_summary: Optional[str] = Field(default=None)
    embedding: Optional[List[float]] = Field(default=None, sa_column=Column(Vector(1536)))

class Module(ModuleBase, table=True):
    __tablename__ = "modules"
    offerings: List["ModuleOffering"] = Relationship(back_populates="module")
    reviews: List["Review"] = Relationship(back_populates="module")

class ModuleOffering(SQLModel, table=True):
    __tablename__ = "module_offerings"
    id: Optional[int] = Field(default=None, primary_key=True)
    module_code: str = Field(foreign_key="modules.module_code")
    acad_year: str
    semester: int
    
    module: Module = Relationship(back_populates="offerings")

class DegreeRequirement(SQLModel, table=True):
    __tablename__ = "degree_requirements"
    id: Optional[int] = Field(default=None, primary_key=True)
    degree: str
    faculty: str
    major: str
    total_units: float = Field(default=160.0)
    requirements: Dict = Field(default={}, sa_column=Column(JSON))
    notes: Optional[str] = None
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

class User(SQLModel, table=True):
    __tablename__ = "users"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    email: str = Field(unique=True, index=True)
    name: str
    major: str
    admit_year: str
    
    plans: List["Plan"] = Relationship(back_populates="user")
    reviews: List["Review"] = Relationship(back_populates="user")

class Plan(SQLModel, table=True):
    __tablename__ = "plans"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id")
    name: str
    content: Dict = Field(default={}, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    user: User = Relationship(back_populates="plans")

class Review(SQLModel, table=True):
    __tablename__ = "reviews"
    id: Optional[int] = Field(default=None, primary_key=True)
    module_code: str = Field(foreign_key="modules.module_code")
    user_id: Optional[UUID] = Field(default=None, foreign_key="users.id")
    rating: int
    comment: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    source: str = Field(default="Internal") # "Disqus" or "Internal"
    
    module: Module = Relationship(back_populates="reviews")
    user: Optional[User] = Relationship(back_populates="reviews")
