# Flowmake - Python to Flowchart Visualizer

Flowmake is a full-stack application that automatically converts Python source code into modern, professional flowcharts. It parses your code's Abstract Syntax Tree (AST), identifies logic flows, and renders them as high-quality images.

![Project Screenshot](https://via.placeholder.com/800x450?text=Dashboard+Preview)

## 🚀 Features

### Core Logic
* **Smart AST Parsing:** Reads raw Python code and understands `if/else`, loops, and function calls.
* **Intelligent Summarization:** Automatically groups repetitive code (e.g., "Print (x5)") to keep charts clean, while preserving complex logic details.
* **Class & Folder Support:** organizing methods into specific folders based on their Class.

### Visualization
* **Modern Aesthetics:** Uses orthogonal (circuit-board style) lines, rounded corners, and a pastel color palette.
* **Semantic Color Coding:**
    * 🟢 **Green:** Start / End
    * 🔵 **Blue:** Process / Logic / Assignments
    * 🟣 **Purple:** I/O (Print statements, Returns)
    * 🟠 **Orange:** Decisions (If/Else)

### User Interface
* **Interactive Dashboard:** A React-based sidebar layout to browse generated charts.
* **Instant Preview:** Unzips and renders flowcharts directly in the browser—no download required to view.
* **Masonry Grid:** Responsive layout that maximizes screen real estate (16:9).

---

## 🛠️ Tech Stack

* **Backend:** Python, FastAPI, Graphviz, AST
* **Frontend:** React (Vite), Lucide Icons, JSZip, React Dropzone
* **Rendering:** Graphviz (System Binary)

---

## 📦 Prerequisites

Before running the project, ensure you have the following installed:

1.  **Python 3.9+**
2.  **Node.js & npm** (for the frontend)
3.  **Graphviz (System Binary)** — *Crucial Step!*
    * **Windows:** [Download Installer](https://graphviz.org/download/) (Make sure to select "Add Graphviz to system PATH" during install).
    * **Mac:** `brew install graphviz`
    * **Linux (Ubuntu):** `sudo apt-get install graphviz`

---

## ⚡ Quick Start

### 1. Backend Setup (FastAPI)

Navigate to the backend folder (or root if combined):

```bash
# 1. Create virtual environment (Optional but recommended)
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# 2. Install dependencies
pip install fastapi "uvicorn[standard]" graphviz

# 3. Run the Server
uvicorn main:app --reload --host 127.0.0.1 --port 8000
