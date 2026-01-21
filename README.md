# Python Flowchart Generator API 

This is a FastAPI backend that converts Python source code into visual flowcharts.

## Features
- Upload a `.py` file.
- Detects Functions and Classes automatically.
- Generates a Flowchart for every method.
- Returns a ZIP file containing organized PNG images.

## How to Run
1. Install Graphviz on your machine (e.g., `sudo apt-get install graphviz`).
2. Install dependencies: `pip install -r requirements.txt`
3. Run server: `uvicorn main:app --reload`
4. Go to `http://localhost:8000/docs` to test.