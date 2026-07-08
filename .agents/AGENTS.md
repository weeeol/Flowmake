# FlowMake Agent Rules

These rules apply specifically to the FlowMake workspace and govern how AI agents should interact with the project documentation, codebase, and design system. You must adhere to these conventions for all future modifications.

## 1. Documentation Guidelines
* **Deployment Instructions:** Keep deployment guides, hosting setup instructions, and complex infrastructure docs separate from the main `README.md`. Use standalone files like `DEPLOYMENT.md` and link to them from the README. The `README.md` should remain focused on features, tech stack, and local development setup for the typical user.

## 2. Frontend & Design System
* **Minimalist Aesthetics:** The app uses a premium, deeply contrasted monochromatic design. Avoid flashy colors, generic primary colored buttons, or heavy drop shadows.
* **Styling Tokens:** Rely on subtle 1px borders for component separation. Use the established dark mode (`#09090b`) and light mode (`#fafafa`) backgrounds.
* **Typography:** Strictly use `Inter` for all UI text and `JetBrains Mono` for code editors and monospaced text.
* **Icons:** Use `lucide-react` for consistent, minimalist line icons.

## 3. Backend Architecture (FastAPI)
* **Modular Structure:** Do not use flat files in the root `backend/` directory. All FastAPI code must reside in the `backend/app/` package structure:
  * `app/main.py`: Application entrypoint
  * `app/api/`: API routers and endpoints
  * `app/services/`: Core business logic (e.g., `builder.py`)
  * `app/schemas/`: Pydantic models for validation
  * `app/database.py` & `app/db_models.py`: SQLAlchemy setup and models.
* **Database:** Snippets are stored in local SQLite (`flowmake.db`). Always ensure database models and dependencies are properly imported via `get_db`.

## 4. Flowchart Visualization (Graphviz)
* **Vector Graphics:** Always default to outputting `svg` format from Graphviz, not bitmaps like `png`, as the frontend relies on SVGs for crisp scaling and interactive "click-to-code" functionality.
* **Monochrome Nodes:** When modifying the `FlowchartBuilder`, ensure any new Graphviz nodes match the minimalist UI. Use white fills (`#ffffff` / `#fafafa`) with dark gray/black borders (`#18181b` / `#71717a`) rather than bright primary colors.
* **Editor Integration:** Any new AST parsing logic (like handling new Python features) must ensure the node's `lineno` is passed to the Graphviz node's `id` attribute (e.g., `id="line-42"`) so the React frontend can map clicks back to the Monaco Editor.
