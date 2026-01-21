from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
import ast
import graphviz
import zipfile
import io

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
        self.dot = graphviz.Digraph(comment=title, format='png')
        # ... keep your styling attributes from the previous step ...
        self.dot.attr(splines='ortho')
        self.dot.attr('node', shape='box', style='filled,rounded', fontname='Helvetica')
        
        self.node_count = 0
        self.last_node = None

    # --- HELPER: Turn Code into Human Text ---
    def summarize(self, node):
        """
        Translates Python AST nodes into simplified English labels.
        """
        # 1. Assignments (e.g., x = 10)
        if isinstance(node, ast.Assign):
            targets = [t.id for t in node.targets if isinstance(t, ast.Name)]
            if targets:
                return f"Set {', '.join(targets)}"
            return "Assign Variable"

        # 2. Augmented Assign (e.g., x += 1)
        elif isinstance(node, ast.AugAssign):
            target = node.target.id if isinstance(node.target, ast.Name) else "Variable"
            op = type(node.op).__name__ # Add, Sub, Mult
            if op == 'Add': return f"Increment {target}"
            if op == 'Sub': return f"Decrement {target}"
            return f"Update {target}"

        # 3. Expressions / Function Calls
        elif isinstance(node, ast.Expr):
            if isinstance(node.value, ast.Call):
                func_name = "Unknown"
                if isinstance(node.value.func, ast.Name):
                    func_name = node.value.func.id
                elif isinstance(node.value.func, ast.Attribute):
                    func_name = node.value.func.attr
                
                # Special readable names for common functions
                if func_name == 'print': return "Output / Print"
                if func_name == 'sleep': return "Wait"
                return f"Call {func_name}()"
            return "Action"

        # 4. Return Statements
        elif isinstance(node, ast.Return):
            return "Return Result"

        # Fallback: specific raw code is too complex, just say "Process"
        return "Process Logic"

    # --- NODE CREATION ---
    def new_node(self, label, type='process'):
        node_id = str(self.node_count)
        # We still clean the label just in case
        clean_label = label.replace(':', '').replace('"', "'")
        
        attrs = {}
        if type == 'start_end':
            attrs = {'shape': 'oval', 'fillcolor': '#d1fae5', 'color': '#059669', 'fontcolor': '#064e3b'}
        elif type == 'decision':
            attrs = {'shape': 'diamond', 'fillcolor': '#fff7ed', 'color': '#ea580c', 'fontcolor': '#9a3412'}
        elif type == 'process':
            attrs = {'shape': 'box', 'fillcolor': '#eff6ff', 'color': '#2563eb', 'fontcolor': '#1e3a8a'}
        elif type == 'io': # New type for Print/Return
            attrs = {'shape': 'parallelogram', 'fillcolor': '#f3e8ff', 'color': '#7e22ce', 'fontcolor': '#581c87'}

        self.dot.node(node_id, clean_label, **attrs)
        self.node_count += 1
        return node_id

    def add_edge(self, start, end, label=''):
        if start and end:
            # If there is a label (like "Yes"/"No"), give it a background 
            # so lines don't strike through the text
            if label:
                self.dot.edge(start, end, label=f"  {label}  ", fontcolor='#0f172a')
            else:
                self.dot.edge(start, end)

    def build_from_node(self, node):
        start_id = self.new_node("Start", type='start_end')
        self.last_node = start_id
        
        for item in node.body:
            self.visit(item)
            
        end_id = self.new_node("End", type='start_end')
        self.add_edge(self.last_node, end_id)

    def visit_Assign(self, node):
        label = self.summarize(node)
        action_id = self.new_node(label, type='process')
        self.add_edge(self.last_node, action_id)
        self.last_node = action_id

    def visit_AugAssign(self, node): # Handle x += 1
        label = self.summarize(node)
        action_id = self.new_node(label, type='process')
        self.add_edge(self.last_node, action_id)
        self.last_node = action_id

    def visit_Expr(self, node):
        label = self.summarize(node)
        # Check if it's an Output action to give it a distinct shape
        node_type = 'io' if 'Output' in label else 'process'
        action_id = self.new_node(label, type=node_type)
        self.add_edge(self.last_node, action_id)
        self.last_node = action_id

    def visit_Return(self, node):
        label = self.summarize(node)
        action_id = self.new_node(label, type='io')
        self.add_edge(self.last_node, action_id)
        self.last_node = action_id

    def visit_If(self, node):
        # Decisions usually need the specific condition to make sense,
        # so we keep the raw condition but formatted nicely.
        try:
            condition = ast.unparse(node.test)
        except AttributeError:
            condition = "Condition"
            
        decision_id = self.new_node(f"Is {condition}?", type='decision')
        self.add_edge(self.last_node, decision_id)
        
        entry_node = decision_id 
        
        # True Path
        self.last_node = entry_node
        for item in node.body:
            self.visit(item)
        true_end = self.last_node
        
        # False Path
        self.last_node = entry_node
        for item in node.orelse:
            self.visit(item)
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