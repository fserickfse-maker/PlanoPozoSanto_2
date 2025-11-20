# -*- coding: utf-8 -*-
from __future__ import annotations

import json, time
from pathlib import Path
from typing import Any, Dict, List
from flask import Flask, jsonify, request, render_template, session

BASE = Path(__file__).parent
DATA_DIR = BASE / "data"
DATA_DIR.mkdir(exist_ok=True)
LOTES_FILE = DATA_DIR / "lotes.json"
USERS_FILE = DATA_DIR / "users.json"

app = Flask(__name__)
app.secret_key = "dev-secret-change-me"

def _read_json(path: Path, default):
    if not path.exists():
        return default
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default

def _write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_lotes() -> List[Dict[str, Any]]:
    return _read_json(LOTES_FILE, [])

def save_lotes(items: List[Dict[str, Any]]):
    _write_json(LOTES_FILE, items)

def load_users() -> List[Dict[str, Any]]:
    return _read_json(USERS_FILE, [{"email": "demo@demo.com", "password": "demo", "name": "Lucas"}])

def save_users(items: List[Dict[str, Any]]):
    _write_json(USERS_FILE, items)

def current_user():
    return session.get("user")

@app.get("/")
def admin():
    return render_template("index.html")

@app.get("/cliente")
def cliente():
    return render_template("cliente.html")

@app.get("/lotes")
def api_lotes():
    return jsonify(load_lotes())

@app.post("/lotes")
def api_create_lote():
    data = request.get_json(force=True, silent=True) or {}
    name = (data.get("name") or "Lote").strip()
    estado = (data.get("estado") or "disponible").lower()
    coords = data.get("coords") or []
    altura = data.get("altura")
    try:
        altura = float(altura) if altura is not None else None
    except Exception:
        altura = None

    items = load_lotes()
    new_id = f"lot-{int(time.time()*1000)}-{len(items)+1}"
    item = {
        "id": new_id,
        "name": name or "Lote",
        "estado": estado,
        "coords": coords,
        "altura": altura,
        "reservedBy": None,
        "reservedAt": None,
    }
    items.append(item)
    save_lotes(items)
    return jsonify(item), 201

@app.post("/lotes/update/<_id>")
def api_update_lote(_id):
    data = request.get_json(force=True, silent=True) or {}
    name = (data.get("name") or "").strip()
    estado = (data.get("estado") or "").lower() or None
    altura = data.get("altura")
    reserved_by = data.get("reservedBy")
    items = load_lotes()
    u = current_user()
    current_name = u.get("name") if u else None

    for it in items:
        if it.get("id") == _id:
            if name:
                it["name"] = name
            if altura is not None:
                try:
                    it["altura"] = float(altura)
                except Exception:
                    pass
            if estado:
                it["estado"] = estado
                if estado == "reservado":
                    it["reservedBy"] = reserved_by or current_name
                    it["reservedAt"] = int(time.time() * 1000)
                else:
                    it["reservedBy"] = None
                    it["reservedAt"] = None
            break

    save_lotes(items)
    return jsonify({"ok": True})

@app.post("/lotes/delete")
def api_delete_lotes():
    data = request.get_json(force=True, silent=True) or {}
    ids = set(data.get("ids") or [])
    items = [it for it in load_lotes() if it.get("id") not in ids]
    save_lotes(items)
    return jsonify({"ok": True, "deleted": list(ids)})

@app.post("/reset")
def api_reset():
    save_lotes([])
    return jsonify({"ok": True})

@app.post("/auth/register")
def register():
    data = request.get_json(force=True, silent=True) or {}
    email = (data.get("email") or "").lower().strip()
    password = data.get("password") or ""
    name = (data.get("name") or "").strip()
    if not email or not password:
        return jsonify({"ok": False, "error": "email y contraseña requeridos"}), 400
    users = load_users()
    for u in users:
        if u.get("email") == email:
            return jsonify({"ok": False, "error": "correo ya registrado"}), 400
    if not name:
        name = email.split("@")[0] if "@" in email else "Usuario"
    users.append({"email": email, "password": password, "name": name})
    save_users(users)
    session["user"] = {"email": email, "name": name}
    return jsonify({"ok": True, "user": session["user"]})

@app.post("/auth/login")
def login():
    data = request.get_json(force=True, silent=True) or {}
    email = (data.get("email") or "").lower().strip()
    password = data.get("password") or ""
    for u in load_users():
        if u["email"] == email and u["password"] == password:
            session["user"] = {
                "email": u["email"],
                "name": u.get("name") or u["email"].split("@")[0],
            }
            return jsonify({"ok": True, "user": session["user"]})
    return jsonify({"ok": False, "error": "credenciales inválidas"}), 401

@app.post("/auth/logout")
def logout():
    session.pop("user", None)
    return jsonify({"ok": True})

@app.get("/auth/me")
def me():
    return jsonify({"ok": True, "user": current_user()})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
