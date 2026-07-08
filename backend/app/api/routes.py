import ast
import io
import zipfile

import uuid

from fastapi import APIRouter, File, HTTPException, UploadFile, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.services.builder import FlowchartBuilder
from app.schemas.models import CodeSnippet
from app.database import get_db
from app.db_models import DbCodeSnippet

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
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                builder = FlowchartBuilder(node.name, fmt="png")
                builder.build_from_node(node)
                img_data = builder.dot.pipe()
                zip_file.writestr(f"{node.name}.png", img_data)

            elif isinstance(node, ast.ClassDef):
                class_name = node.name
                for class_item in node.body:
                    if isinstance(class_item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        method_name = class_item.name

                        builder = FlowchartBuilder(f"{class_name}.{method_name}", fmt="png")
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
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            target_node = node
            break

    if not target_node:
        target_node = ast.FunctionDef(
            name="Main",
            args=ast.arguments(args=[], defaults=[]),
            body=tree.body,
            decorator_list=[],
        )

    builder = FlowchartBuilder(target_node.name if hasattr(target_node, "name") else "Main", fmt=snippet.format)
    if isinstance(target_node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        builder.build_from_node(target_node)
    else:
        builder.visit_stmts(tree.body)

    img_data = builder.dot.pipe()
    media_type = f"image/{snippet.format}"
    if snippet.format == "svg":
        media_type = "image/svg+xml"
    elif snippet.format == "pdf":
        media_type = "application/pdf"
    
    return Response(content=img_data, media_type=media_type)

@router.post("/snippets")
async def save_snippet(snippet: CodeSnippet, db: Session = Depends(get_db)):
    snippet_id = str(uuid.uuid4())[:8]
    db_snippet = DbCodeSnippet(id=snippet_id, code=snippet.code)
    db.add(db_snippet)
    db.commit()
    return {"id": snippet_id}

@router.get("/snippets/{snippet_id}")
async def get_snippet(snippet_id: str, db: Session = Depends(get_db)):
    db_snippet = db.query(DbCodeSnippet).filter(DbCodeSnippet.id == snippet_id).first()
    if not db_snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return {"code": db_snippet.code}
