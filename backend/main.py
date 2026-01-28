from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
import ast
import graphviz
import zipfile
import io
import textwrap
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins (for development)
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (POST, GET, etc.)
    allow_headers=["*"],
)

# --- BUILDER CLASS (Unchanged logic, just keeping it here for context) ---
class FlowchartBuilder(ast.NodeVisitor):
    def __init__(self, title):
        # ... (Keep your existing __init__ styles: fonts, colors, splines='ortho') ...
        self.dot = graphviz.Digraph(comment=title, format='png')
        self.dot.attr(splines='ortho')
        self.dot.attr('node', shape='box', style='filled,rounded', fontname='Helvetica')
        
        self.node_count = 0
        self.last_node = None

    # --- 1. REUSE YOUR SUMMARIZE FUNCTION ---
    def summarize(self, node):
        """
        Returns a tuple: (Label, Type)
        Type helps us decide if we should merge this node with the previous one.
        """
        # A. Assignments
        if isinstance(node, ast.Assign):
            targets = [t.id for t in node.targets if isinstance(t, ast.Name)]
            code_preview = ast.unparse(node)
            # If short, show code. If long, summarize.
            label = code_preview if len(code_preview) < 30 else f"Set {', '.join(targets)}"
            return (label, 'assign')

        # B. Expressions / Calls
        elif isinstance(node, ast.Expr):
            code = ast.unparse(node).strip()
            
            # Detect Function Calls
            if isinstance(node.value, ast.Call):
                func_name = "Unknown"
                if isinstance(node.value.func, ast.Name): 
                    func_name = node.value.func.id
                elif isinstance(node.value.func, ast.Attribute): 
                    func_name = node.value.func.attr
                
                if func_name == 'print': 
                    return ("Output / Print", 'io')
                
                # For other functions, show the call (e.g., "hash_password()")
                # Truncate if it's a giant line
                label = textwrap.shorten(code, width=30, placeholder="...")
                return (label, 'process')

            return (textwrap.shorten(code, width=30), 'process')

        # C. Return
        elif isinstance(node, ast.Return):
            # Show what is being returned if possible
            if node.value:
                val = ast.unparse(node.value)
                return (f"Return {val}", 'io')
            return ("Return", 'io')

        # Fallback: Just show the code!
        try:
            code = ast.unparse(node)
            return (textwrap.shorten(code, width=30), 'process')
        except:
            return ("Process Logic", 'process')
        
    # --- 2. NEW: NODE CREATION (With Colors) ---
    def new_node(self, label, type='process'):
        node_id = str(self.node_count)
        clean_label = label.replace(':', '').replace('"', "'")
        
        attrs = {}
        if type == 'start_end':
            attrs = {'shape': 'oval', 'fillcolor': '#d1fae5', 'color': '#059669', 'fontcolor': '#064e3b'}
        elif type == 'decision':
            attrs = {'shape': 'diamond', 'fillcolor': '#fff7ed', 'color': '#ea580c', 'fontcolor': '#9a3412'}
        elif type == 'process':
            attrs = {'shape': 'box', 'fillcolor': '#eff6ff', 'color': '#2563eb', 'fontcolor': '#1e3a8a'}
        elif type == 'io': 
            attrs = {'shape': 'parallelogram', 'fillcolor': '#f3e8ff', 'color': '#7e22ce', 'fontcolor': '#581c87'}

        self.dot.node(node_id, clean_label, **attrs)
        self.node_count += 1
        return node_id

    def add_edge(self, start, end, label=''):
        if start and end:
            self.dot.edge(start, end, label=label)

    # --- 3. NEW: THE BATCH PROCESSOR ---
    def visit_stmts(self, stmts):
        buffer = []
        last_type = None

        def flush_buffer():
            nonlocal last_type
            if not buffer: return
            
            # Generate labels for everything in buffer
            node_data = [self.summarize(n) for n in buffer]
            labels = [n[0] for n in node_data]
            types = [n[1] for n in node_data]
            
            # Collapse ONLY duplicates
            # (e.g. "Print", "Print" -> "Print (x2)")
            # But "x=1", "y=2" -> Stay separate lines in one box
            collapsed_labels = []
            if labels:
                current_label = labels[0]
                count = 1
                for i in range(1, len(labels)):
                    if labels[i] == current_label:
                        count += 1
                    else:
                        txt = f"{current_label} (x{count})" if count > 1 else current_label
                        collapsed_labels.append(txt)
                        current_label = labels[i]
                        count = 1
                txt = f"{current_label} (x{count})" if count > 1 else current_label
                collapsed_labels.append(txt)

            full_label = "\n".join(collapsed_labels)
            
            # Decide visual style based on majority content
            is_io = any(t == 'io' for t in types)
            style_type = 'io' if is_io else 'process'

            node_id = self.new_node(full_label, type=style_type)
            self.add_edge(self.last_node, node_id)
            self.last_node = node_id
            
            buffer.clear()
            last_type = None

        for node in stmts:
            # We treat these as "simple" linear nodes
            if isinstance(node, (ast.Assign, ast.AugAssign, ast.Expr, ast.Return, ast.Pass)):
                current_label, current_type = self.summarize(node)
                
                # LOGIC: When to break the chain?
                # 1. If the Type changes (e.g. going from Assignment -> Print)
                # 2. OR if it's a Return statement (always isolate returns)
                if last_type and (current_type != last_type or current_type == 'io' or last_type == 'io'):
                     flush_buffer()
                
                buffer.append(node)
                last_type = current_type
            else:
                # Complex structure (If/For) -> Flush immediately
                flush_buffer()
                self.visit(node)

        flush_buffer()

    # --- 4. UPDATED VISITORS ---
    def build_from_node(self, node):
        start_id = self.new_node("Start", type='start_end')
        self.last_node = start_id
        
        # USE NEW BATCH PROCESSOR
        self.visit_stmts(node.body)
            
        end_id = self.new_node("End", type='start_end')
        self.add_edge(self.last_node, end_id)

    def visit_If(self, node):
        try:
            condition = ast.unparse(node.test)
        except:
            condition = "Condition"
            
        decision_id = self.new_node(f"Is {condition}?", type='decision')
        self.add_edge(self.last_node, decision_id)
        
        entry_node = decision_id 
        
        # True Path
        self.last_node = entry_node
        self.visit_stmts(node.body) # Use batch processor
        true_end = self.last_node
        
        # False Path
        self.last_node = entry_node
        self.visit_stmts(node.orelse) # Use batch processor
        false_end = self.last_node
        
        merge_id = self.new_node("", type='process')
        self.dot.node(merge_id, shape='point', width='0')
        self.add_edge(true_end, merge_id, label="Yes")
        self.add_edge(false_end, merge_id, label="No")
        self.last_node = merge_id

# --- NEW ZIP ENDPOINT WITH CLASS SUPPORT ---
@app.post("/upload_flowchart_zip")
async def upload_flowchart_zip(file: UploadFile = File(...)):
    if not file.filename.endswith(".py"):
        raise HTTPException(status_code=400, detail="Only .py files supported")
    
    contents = await file.read()
    code_str = contents.decode("utf-8")
    
    try:
        tree = ast.parse(code_str)
    except SyntaxError:
        raise HTTPException(status_code=400, detail="Invalid Python Syntax")

    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
        
        # We iterate over top-level nodes specifically to preserve structure
        for node in tree.body:
            
            # CASE 1: Top-Level Function
            if isinstance(node, ast.FunctionDef):
                builder = FlowchartBuilder(node.name)
                builder.build_from_node(node)
                img_data = builder.dot.pipe()
                # Save as "function_name.png"
                zip_file.writestr(f"{node.name}.png", img_data)

            # CASE 2: Class Definition
            elif isinstance(node, ast.ClassDef):
                class_name = node.name
                # Look inside the class for methods
                for class_item in node.body:
                    if isinstance(class_item, ast.FunctionDef):
                        method_name = class_item.name
                        
                        # Build chart
                        builder = FlowchartBuilder(f"{class_name}.{method_name}")
                        builder.build_from_node(class_item)
                        img_data = builder.dot.pipe()
                        
                        # Save as "ClassName/MethodName.png" 
                        # The slash automatically creates a folder in the zip
                        zip_file.writestr(f"{class_name}/{method_name}.png", img_data)

    zip_buffer.seek(0)
    return Response(
        content=zip_buffer.getvalue(), 
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=flowcharts_organized.zip"}
    )

class CodeSnippet(BaseModel):
    code: str

# 2. Add the Preview Endpoint
@app.post("/preview_flowchart")
async def preview_flowchart(snippet: CodeSnippet):
    """
    Generates a flowchart for the FIRST function found in the text snippet.
    Used for the live playground.
    """
    try:
        tree = ast.parse(snippet.code)
    except SyntaxError as e:
        raise HTTPException(status_code=400, detail=f"Syntax Error: {e.msg} (Line {e.lineno})")

    # Find the first function to visualize
    target_node = None
    for node in tree.body:
        if isinstance(node, ast.FunctionDef):
            target_node = node
            break
    
    # If no function, wrap the whole script in a fake "Main" function so it renders
    if not target_node:
        # Wrap top-level code in a Module/Function wrapper for the builder
        target_node = ast.FunctionDef(name="Main", args=ast.arguments(args=[], defaults=[]), body=tree.body, decorator_list=[])

    # Build Chart
    builder = FlowchartBuilder(target_node.name if hasattr(target_node, 'name') else "Main")
    # Use our smart "batch processor" from before
    if isinstance(target_node, ast.FunctionDef):
        builder.build_from_node(target_node)
    else:
        # Fallback for raw scripts
        builder.visit_stmts(tree.body)

    img_data = builder.dot.pipe()
    return Response(content=img_data, media_type="image/png")