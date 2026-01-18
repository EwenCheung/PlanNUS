# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Install system dependencies (needed for some python packages like psycopg2 if non-binary)
# psycopg2-binary is used, so valid, but we might need gcc or others for some wheels.
# It is safer to install build essentials.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the current directory contents into the container at /app
COPY . .

# Make port 8000 available to the world outside this container
EXPOSE 8000

# Run app.main:app when the container launches
# reload is not included for production/docker usually, but can be added if requested.
# For 'starting the project', standard execution is best.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
