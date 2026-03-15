import ast
import textwrap

import graphviz


class FlowchartBuilder(ast.NodeVisitor):
    def __init__(self, title):
        self.dot = graphviz.Digraph(comment=title, format="png")
        self.dot.attr(splines="ortho")
        self.dot.attr("node", shape="box", style="filled,rounded", fontname="Helvetica")

        self.node_count = 0
        self.last_node = None

    def summarize(self, node):
        """
        Returns a tuple: (label, type)
        Type helps decide if we should merge this node with the previous one.
        """
        if isinstance(node, ast.Assign):
            targets = [t.id for t in node.targets if isinstance(t, ast.Name)]
            code_preview = ast.unparse(node)
            label = code_preview if len(code_preview) < 30 else f"Set {', '.join(targets)}"
            return (label, "assign")

        if isinstance(node, ast.Expr):
            code = ast.unparse(node).strip()

            if isinstance(node.value, ast.Call):
                func_name = "Unknown"
                if isinstance(node.value.func, ast.Name):
                    func_name = node.value.func.id
                elif isinstance(node.value.func, ast.Attribute):
                    func_name = node.value.func.attr

                if func_name == "print":
                    return ("Output / Print", "io")

                label = textwrap.shorten(code, width=30, placeholder="...")
                return (label, "process")

            return (textwrap.shorten(code, width=30), "process")

        if isinstance(node, ast.Return):
            if node.value:
                val = ast.unparse(node.value)
                return (f"Return {val}", "io")
            return ("Return", "io")

        try:
            code = ast.unparse(node)
            return (textwrap.shorten(code, width=30), "process")
        except Exception:
            return ("Process Logic", "process")

    def new_node(self, label, type="process"):
        node_id = str(self.node_count)
        clean_label = label.replace(":", "").replace('"', "'")

        attrs = {}
        if type == "start_end":
            attrs = {
                "shape": "oval",
                "fillcolor": "#d1fae5",
                "color": "#059669",
                "fontcolor": "#064e3b",
            }
        elif type == "decision":
            attrs = {
                "shape": "diamond",
                "fillcolor": "#fff7ed",
                "color": "#ea580c",
                "fontcolor": "#9a3412",
            }
        elif type == "process":
            attrs = {
                "shape": "box",
                "fillcolor": "#eff6ff",
                "color": "#2563eb",
                "fontcolor": "#1e3a8a",
            }
        elif type == "io":
            attrs = {
                "shape": "parallelogram",
                "fillcolor": "#f3e8ff",
                "color": "#7e22ce",
                "fontcolor": "#581c87",
            }

        self.dot.node(node_id, clean_label, **attrs)
        self.node_count += 1
        return node_id

    def add_edge(self, start, end, label=""):
        if start and end:
            self.dot.edge(start, end, label=label)

    def visit_stmts(self, stmts):
        buffer = []
        last_type = None

        def flush_buffer():
            nonlocal last_type
            if not buffer:
                return

            node_data = [self.summarize(n) for n in buffer]
            labels = [n[0] for n in node_data]
            types = [n[1] for n in node_data]

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
            is_io = any(t == "io" for t in types)
            style_type = "io" if is_io else "process"

            node_id = self.new_node(full_label, type=style_type)
            self.add_edge(self.last_node, node_id)
            self.last_node = node_id

            buffer.clear()
            last_type = None

        for node in stmts:
            if isinstance(node, (ast.Assign, ast.AugAssign, ast.Expr, ast.Return, ast.Pass)):
                _, current_type = self.summarize(node)

                if last_type and (current_type != last_type or current_type == "io" or last_type == "io"):
                    flush_buffer()

                buffer.append(node)
                last_type = current_type
            else:
                flush_buffer()
                self.visit(node)

        flush_buffer()

    def build_from_node(self, node):
        start_id = self.new_node("Start", type="start_end")
        self.last_node = start_id

        self.visit_stmts(node.body)

        end_id = self.new_node("End", type="start_end")
        self.add_edge(self.last_node, end_id)

    def visit_If(self, node):
        try:
            condition = ast.unparse(node.test)
        except Exception:
            condition = "Condition"

        decision_id = self.new_node(f"Is {condition}?", type="decision")
        self.add_edge(self.last_node, decision_id)

        entry_node = decision_id

        self.last_node = entry_node
        self.visit_stmts(node.body)
        true_end = self.last_node

        self.last_node = entry_node
        self.visit_stmts(node.orelse)
        false_end = self.last_node

        merge_id = self.new_node("", type="process")
        self.dot.node(merge_id, shape="point", width="0")
        self.add_edge(true_end, merge_id, label="Yes")
        self.add_edge(false_end, merge_id, label="No")
        self.last_node = merge_id

    def visit_Try(self, node):
        try_start_id = self.new_node("Try / Attempt", type="decision")
        self.dot.node(
            try_start_id,
            "Attempt",
            shape="diamond",
            color="#d97706",
            fillcolor="#fcd34d",
        )
        self.add_edge(self.last_node, try_start_id)

        entry_node = try_start_id
        self.last_node = try_start_id

        self.visit_stmts(node.body)
        success_end = self.last_node

        exception_ends = []

        for handler in node.handlers:
            self.last_node = entry_node

            exc_name = "Exception"
            if handler.type:
                try:
                    exc_name = ast.unparse(handler.type)
                except Exception:
                    exc_name = "Error"

            if handler.body:
                catch_id = self.new_node(f"Catch: {exc_name}", type="process")
                self.dot.node(
                    catch_id,
                    color="#dc2626",
                    fontcolor="#991b1b",
                    fillcolor="#fecaca",
                )

                self.dot.edge(
                    entry_node,
                    catch_id,
                    label="On Error",
                    style="dashed",
                    color="#dc2626",
                    fontcolor="#dc2626",
                )

                self.last_node = catch_id
                self.visit_stmts(handler.body)
                exception_ends.append(self.last_node)

        if node.finalbody:
            finally_start = self.new_node("Finally", type="process")
            self.dot.node(
                finally_start,
                shape="oval",
                style="filled",
                fillcolor="#e5e7eb",
                color="#9ca3af",
            )

            self.add_edge(success_end, finally_start)

            for exc_end in exception_ends:
                self.add_edge(exc_end, finally_start)

            self.last_node = finally_start
            self.visit_stmts(node.finalbody)
        else:
            merge_id = self.new_node("", type="process")
            self.dot.node(merge_id, shape="point", width="0")

            self.add_edge(success_end, merge_id)
            for exc_end in exception_ends:
                self.add_edge(exc_end, merge_id)

            self.last_node = merge_id
