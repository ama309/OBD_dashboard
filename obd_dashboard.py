# sudo apt update
# sudo apt install python3-pip
# pip3 install flask flask-socketio obd


# cd ~/obd_dashboard
# python3 obd_dashboard.py


# on tablet, go to https://... outputted on flask


import time
import json
import obd
from flask import Flask, render_template
from flask_socketio import SocketIO
from obd import OBDCommand

# -----------------------------
# Flask + SocketIO setup
# -----------------------------
app = Flask(__name__)
socketio = SocketIO(app)

@app.route("/")
def index():
    return render_template("dashboard.html")  # dashboard HTML

# -----------------------------
# Connect to OBD-II adapter
# -----------------------------
print("Connecting to OBDLink SX...")
connection = None  # auto-detect USB port

print("Attempting to connect to OBDLink SX...")

try:
    connection = obd.OBD()  # auto-detect
except Exception:
    connection = None

if connection is None or not connection.is_connected():
    print("No OBD adapter detected, running in demo mode.")
    connection = None  # ensures your read_obd_data() sends zeros
else:
    print("Connected to OBD-II adapter.")
    
# -----------------------------
# Define PIDs to read
# -----------------------------
standard_cmds = [
    obd.commands.RPM,
    obd.commands.SPEED,
    obd.commands.COOLANT_TEMP,
    obd.commands.THROTTLE_POS,
    obd.commands.FUEL_LEVEL,
]

extended_cmds = [
    OBDCommand("GEAR", "Gear", b"\x22\xF1\x90", 1, lambda x: x[0]),
    OBDCommand("TURBO", "Turbo_kPa", b"\x22\xF1\x92", 2, lambda x: int.from_bytes(x, byteorder='big'))
]

# -----------------------------
# Function to read all data
# -----------------------------
def read_obd_data():
    data = {}

    if connection is not None and connection.is_connected():
        for cmd in standard_cmds:
            try:
                if connection.supports(cmd):
                    response = connection.query(cmd)
                    data[cmd.name] = (
                        float(response.value.magnitude)
                        if response.value is not None
                        else 0.0
                    )
                else:
                    data[cmd.name] = 0.0
            except Exception:
                data[cmd.name] = 0.0

        for cmd in extended_cmds:
            try:
                response = connection.query(cmd)
                data[cmd.name] = (
                    response.value if response.value is not None else 0.0
                )
            except Exception:
                data[cmd.name] = 0.0
    else:
        # Demo / fallback values so dashboard still works
        for cmd in standard_cmds + extended_cmds:
            data[cmd.name] = 0.0

    return data

# -----------------------------
# Background task to send data
# -----------------------------
def send_data():
    while True:
        obd_data = read_obd_data()
        socketio.emit("obd_update", obd_data)
        time.sleep(0.5)

# -----------------------------
# Start server
# -----------------------------
if __name__ == "__main__":
    from threading import Thread

    thread = Thread(target=send_data, daemon=True)
    thread.start()
    socketio.run(app, host="0.0.0.0", port=5000)