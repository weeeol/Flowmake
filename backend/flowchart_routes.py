import ast
import io
import zipfile

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response

from flowchart_builder import FlowchartBuilder
from schemas import CodeSnippet


router = APIRouter()


@router.post("/upload_flowchart_zip")
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
        for node in tree.body:
            if isinstance(node, ast.FunctionDef):
                builder = FlowchartBuilder(node.name)
                builder.build_from_node(node)
                img_data = builder.dot.pipe()
                zip_file.writestr(f"{node.name}.png", img_data)

            elif isinstance(node, ast.ClassDef):
                class_name = node.name
                for class_item in node.body:
                    if isinstance(class_item, ast.FunctionDef):
                        method_name = class_item.name

                        builder = FlowchartBuilder(f"{class_name}.{method_name}")
                        builder.build_from_node(class_item)
                        img_data = builder.dot.pipe()

                        zip_file.writestr(f"{class_name}/{method_name}.png", img_data)

    zip_buffer.seek(0)
    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=flowcharts_organized.zip"},
    )


@router.post("/preview_flowchart")
async def preview_flowchart(snippet: CodeSnippet):
    """
    Generates a flowchart for the first function found in the text snippet.
    Used for the live playground.
    """
    try:
        tree = ast.parse(snippet.code)
    except SyntaxError as e:
        raise HTTPException(status_code=400, detail=f"Syntax Error: {e.msg} (Line {e.lineno})")

    target_node = None
    for node in tree.body:
        if isinstance(node, ast.FunctionDef):
            target_node = node
            break

    if not target_node:
        target_node = ast.FunctionDef(
            name="Main",
            args=ast.arguments(args=[], defaults=[]),
            body=tree.body,
            decorator_list=[],
        )

    builder = FlowchartBuilder(target_node.name if hasattr(target_node, "name") else "Main")
    if isinstance(target_node, ast.FunctionDef):
        builder.build_from_node(target_node)
    else:
        builder.visit_stmts(tree.body)

    img_data = builder.dot.pipe()
    return Response(content=img_data, media_type="image/png")
