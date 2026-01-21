from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import Response
import ast
import graphviz
import zipfile
import io

app = FastAPI()

# --- BUILDER CLASS (Unchanged logic, just keeping it here for context) ---
class FlowchartBuilder(ast.NodeVisitor):
    def __init__(self, title):
        self.dot = graphviz.Digraph(comment=title, format='png')
        self.dot.attr(rankdir='TB') 
        self.dot.attr(label=f"Flowchart: {title}")
        self.dot.attr(fontsize='20')
        self.node_count = 0
        self.last_node = None

    def new_node(self, label, shape='box'):
        node_id = str(self.node_count)
        clean_label = label.replace(':', '').replace('"', "'")
        self.dot.node(node_id, clean_label, shape=shape)
        self.node_count += 1
        return node_id

    def add_edge(self, start, end, label=''):
        if start and end:
            self.dot.edge(start, end, label=label)

    def build_from_node(self, node):
        start_id = self.new_node("Start", shape='oval')
        self.last_node = start_id
        for item in node.body:
            self.visit(item)
        end_id = self.new_node("End", shape='oval')
        self.add_edge(self.last_node, end_id)

    def visit_If(self, node):
        try:
            condition = ast.unparse(node.test)
        except AttributeError:
            condition = "Condition"
        decision_id = self.new_node(f"Is {condition}?", shape='diamond')
        self.add_edge(self.last_node, decision_id)
        entry_node = decision_id 
        
        self.last_node = entry_node
        for item in node.body:
            self.visit(item)
        true_end = self.last_node
        
        self.last_node = entry_node
        for item in node.orelse:
            self.visit(item)
        false_end = self.last_node
        
        merge_id = self.new_node("", shape='point')
        self.add_edge(true_end, merge_id, label="Yes")
        self.add_edge(false_end, merge_id, label="No")
        self.last_node = merge_id

    def visit_Assign(self, node):
        self.add_edge(self.last_node, self.new_node(ast.unparse(node)))
        self.last_node = str(self.node_count - 1)

    def visit_Expr(self, node):
        self.add_edge(self.last_node, self.new_node(ast.unparse(node)))
        self.last_node = str(self.node_count - 1)

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