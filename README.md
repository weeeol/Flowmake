# FlowMake - Python to Flowchart Visualizer

FlowMake is a modern full-stack application that automatically converts Python source code into professional, orthogonal flowcharts. It features a stunning minimalist interface, real-time visualization, and deep editor integration.

## 🚀 Features

### 🌟 Core Experience
* **Live Playground:** Type Python code on the left and see the flowchart generate instantly on the right.
* **Interactive Click-to-Code:** Click on any node in the generated SVG flowchart to instantly scroll the code editor to the exact line of Python that generated it!
* **Save & Share:** Save your code snippets securely to a local SQLite database and share them with colleagues via a unique URL (`?id=xyz`).
* **Vector Graphics:** Flowcharts are rendered in pure SVG, ensuring they remain razor-sharp no matter how closely you zoom in.
* **Smart Dashboard:** Drag & drop `.py` files to auto-generate flowcharts for every function and class.
* **Minimalist Design:** A sleek, premium, monochromatic UI with a built-in dark theme toggle for late-night coding sessions 🌙.

### 🎨 Visuals & Parsing
* **AST Analysis:** Uses Python's Abstract Syntax Tree to accurately map code flow.
* **Enhanced Parsing:** Fully supports modern Python features, including `async def` functions, `match`/`case` structural pattern matching, `try`/`catch` blocks, and loops.
* **Minimalist Styling:** Nodes are styled cleanly with grayscale palettes to perfectly match both light and dark themes.

---

## 🛠️ Tech Stack

* **Frontend:** React (Vite), Monaco Editor, Lucide Icons, Axios
* **Visualization:** Graphviz SVG output with interactive React wrappers
* **Backend:** Python, FastAPI, SQLAlchemy, SQLite
* **Analysis:** Python `ast` (Abstract Syntax Tree)

---

## 📦 How to Run

Since this project relies on system-level graphics rendering, you must install **Graphviz** on your computer first.

### 1. Install Prerequisites
* **Windows:** [Download Graphviz Installer](https://graphviz.org/download/) (Select **"Add Graphviz to system PATH"** during install).
* **Mac:** `brew install graphviz`
* **Linux:** `sudo apt-get install graphviz`

### 2. Backend Setup
Navigate to the `backend` folder:

```bash
cd backend

# Create virtual environment (Optional but recommended)
python -m venv venv
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the Server (auto-creates the SQLite database on startup)
uvicorn app.main:app --reload
```

### 3. Frontend Setup
Navigate to the `frontend` folder:

```bash
cd frontend

# Install dependencies
npm install

# Run the development server
npm run dev
```

---

## 🌐 Deployment

### Frontend on Vercel
The frontend is configured to use a deploy-time API base URL. Set this environment variable in Vercel:

```bash
VITE_API_BASE_URL=https://your-render-backend.onrender.com
```

Deploy the `frontend` folder as the Vercel project root.

### Backend on Render
The backend is set up to run as a Docker web service on Render.

Required setup:
- Use the repository root as the Render root directory.
- Build from the included `Dockerfile` at the root.
- Set `CORS_ORIGINS` to your Vercel app URL:

```bash
CORS_ORIGINS=https://your-vercel-app.vercel.app
```

Why Docker is needed:
- The app generates flowcharts with Graphviz.
- Render needs the Graphviz system package installed for that rendering step.
- The provided Dockerfile installs Graphviz before starting FastAPI.

### Recommended flow
1. Deploy the backend to Render using the root `Dockerfile`.
2. Copy the Render service URL into `VITE_API_BASE_URL` on Vercel.
3. Deploy the frontend to Vercel.
4. Update `CORS_ORIGINS` on Render if your Vercel domain changes.