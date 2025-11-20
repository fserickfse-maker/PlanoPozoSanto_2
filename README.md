plano_interactivo_final_login_v2 (debug=True)

Contenido:

app.py (Flask)
data/ (lotes.json, usuarios.json, reservas.json)
templates/ (login, register, mapa, admin, admin_lotes)
static/ (css, js)
requirements.txt
Run:

python -m venv venv
venv\Scripts\activate (Windows) or source venv/bin/activate (macOS/Linux)
pip install -r requirements.txt
python app.py
Open http://127.0.0.1:5000/
Default accounts:

admin / admin123 (admin)
cliente1 / cliente123 (cliente)
