# ----- IMPORTS -----
from flask import Flask, render_template, request, jsonify, send_from_directory
from datetime import datetime, timedelta
import json
import os
import logging
import uuid
from werkzeug.utils import secure_filename

# Google API imports
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# ----- APP SETUP -----
# Load credentials from environment variable
google_credentials = os.environ.get('GOOGLE_CREDENTIALS')
credentials_info = json.loads(google_credentials)
credentials = service_account.Credentials.from_service_account_info(
    credentials_info, scopes=SCOPES)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.FileHandler("lodge.log"), logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='static')

# File upload settings
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# ----- GOOGLE API CONFIGURATION -----
# Path to your downloaded service account JSON key file
SERVICE_ACCOUNT_FILE = 'lodge-service-account.json'

# Your Google Sheet ID (from the URL)
SPREADSHEET_ID = '1oQhNGbuzad2XC9kQwXu2CswaHlxLHhHKgngz1wA9iRo'  # Replace with yours

# Your Google Drive folder ID where photos will be stored
DRIVE_FOLDER_ID = '1P4f1lx9w5ay-3Dw4JO3qzjGN8ysTvGt5'  # Replace with yours

# Scopes needed for API access
SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 
          'https://www.googleapis.com/auth/drive']

# ----- GOOGLE API FUNCTIONS -----
def get_google_services():
    """Initialize and return Google Sheets and Drive services"""
    try:
        credentials = service_account.Credentials.from_service_account_file(
            SERVICE_ACCOUNT_FILE, scopes=SCOPES)
        sheets_service = build('sheets', 'v4', credentials=credentials)
        drive_service = build('drive', 'v3', credentials=credentials)
        return sheets_service, drive_service
    except Exception as e:
        logger.error(f"Error connecting to Google services: {str(e)}")
        return None, None

def initialize_data():
    """Load data from Google Sheets or create default data structure"""
    logger.info("Initializing data from Google Sheets...")
    try:
        sheets_service, _ = get_google_services()
        if not sheets_service:
            raise Exception("Could not connect to Google Sheets")
        
        # ----- LOAD ROOMS DATA -----
        rooms_result = sheets_service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID, range='Rooms!A2:F200').execute()
        rooms_values = rooms_result.get('values', [])
        
        rooms_dict = {}
        for row in rooms_values:
            if len(row) >= 1:
                room_number = row[0]
                rooms_dict[room_number] = {
                    "status": row[1] if len(row) > 1 else "vacant", 
                    "guest": json.loads(row[2]) if len(row) > 2 and row[2] else None,
                    "checkin_time": row[3] if len(row) > 3 else None,
                    "balance": int(row[4]) if len(row) > 4 and row[4] else 0,
                    "add_ons": json.loads(row[5]) if len(row) > 5 and row[5] else []
                }
        
        # Ensure all default rooms exist
        first_floor_rooms = [str(i) for i in range(1, 6)] + [str(i) for i in range(13, 21)] + [str(i) for i in range(23, 28)]
        second_floor_rooms = [str(i) for i in range(200, 229)]
        
        for room in first_floor_rooms + second_floor_rooms:
            if room not in rooms_dict:
                rooms_dict[room] = {"status": "vacant", "guest": None, "checkin_time": None, "balance": 0, "add_ons": []}
        
        # ----- LOAD LOGS DATA -----
        # Initialize logs structure
        logs_types = ["cash", "online", "balance", "add_ons", "refunds", "renewals", "booking_payments"]
        logs = {log_type: [] for log_type in logs_types}
        
        # Get logs from Google Sheets
        logs_result = sheets_service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID, range='Logs!A2:H500').execute()
        logs_values = logs_result.get('values', [])
        
        # Process logs data
        for row in logs_values:
            if len(row) >= 6:
                log_type = row[0]
                if log_type in logs:
                    log_entry = {
                        "room": row[1],
                        "name": row[2],
                        "amount": int(row[3]) if row[3].isdigit() else 0,
                        "time": row[4],
                        "date": row[5]
                    }
                    # Add notes if available
                    if len(row) > 6:
                        log_entry["notes"] = row[6]
                    logs[log_type].append(log_entry)
        
        # ----- LOAD TOTALS DATA -----
        totals_result = sheets_service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID, range='Totals!A2:B10').execute()
        totals_values = totals_result.get('values', [])
        
        totals = {
            "cash": 0, "online": 0, "balance": 0, "refunds": 0, "advance_bookings": 0
        }
        
        for row in totals_values:
            if len(row) >= 2 and row[0] in totals:
                totals[row[0]] = int(row[1]) if row[1].isdigit() else 0
        
        # ----- LOAD BOOKINGS DATA -----
        bookings_result = sheets_service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID, range='Bookings!A2:M500').execute()
        bookings_values = bookings_result.get('values', [])
        
        bookings = {}
        for row in bookings_values:
            if len(row) >= 7:
                booking_id = row[0]
                bookings[booking_id] = {
                    "room": row[1],
                    "guest_name": row[2],
                    "guest_mobile": row[3],
                    "check_in_date": row[4],
                    "check_out_date": row[5],
                    "status": row[6],
                    "total_amount": int(row[7]) if len(row) > 7 and row[7].isdigit() else 0,
                    "paid_amount": int(row[8]) if len(row) > 8 and row[8].isdigit() else 0,
                    "balance": int(row[9]) if len(row) > 9 and row[9].isdigit() else 0,
                    "payment_method": row[10] if len(row) > 10 else "cash",
                    "notes": row[11] if len(row) > 11 else "",
                    "photo_path": row[12] if len(row) > 12 else None
                }
        
        return {
            "rooms": rooms_dict,
            "logs": logs,
            "totals": totals,
            "bookings": bookings,
            "last_rent_check": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    except Exception as e:
        logger.error(f"Error loading data from Google Sheets: {str(e)}")
        
        # Create default data structure as fallback
        rooms_dict = {}
        
        # First floor rooms
        for num in list(range(1, 6)) + list(range(13, 21)) + list(range(23, 28)):
            rooms_dict[str(num)] = {"status": "vacant", "guest": None, "checkin_time": None, "balance": 0, "add_ons": []}
        
        # Second floor rooms
        for num in range(200, 229):
            rooms_dict[str(num)] = {"status": "vacant", "guest": None, "checkin_time": None, "balance": 0, "add_ons": []}
        
        default_data = {
            "rooms": rooms_dict,
            "logs": {
                "cash": [], "online": [], "balance": [], "add_ons": [], 
                "refunds": [], "renewals": [], "booking_payments": []
            },
            "totals": {
                "cash": 0, "online": 0, "balance": 0, "refunds": 0, "advance_bookings": 0
            },
            "bookings": {},
            "last_rent_check": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        logger.info("Using default data structure")
        return default_data

def save_data(data):
    """Save data to Google Sheets"""
    try:
        sheets_service, _ = get_google_services()
        if not sheets_service:
            raise Exception("Could not connect to Google Sheets")
        
        # ----- SAVE ROOMS DATA -----
        rooms_values = []
        for room_number, room_info in data["rooms"].items():
            rooms_values.append([
                room_number,
                room_info["status"],
                json.dumps(room_info["guest"]) if room_info["guest"] else "",
                room_info["checkin_time"] if room_info["checkin_time"] else "",
                str(room_info["balance"]),
                json.dumps(room_info["add_ons"]) if room_info["add_ons"] else ""
            ])
        
        # Clear and update Rooms sheet
        sheets_service.spreadsheets().values().clear(
            spreadsheetId=SPREADSHEET_ID, range='Rooms!A2:F500').execute()
        
        if rooms_values:
            sheets_service.spreadsheets().values().update(
                spreadsheetId=SPREADSHEET_ID, range='Rooms!A2',
                valueInputOption='RAW', body={"values": rooms_values}).execute()
        
        # ----- SAVE LOGS DATA -----
        logs_values = []
        for log_type, log_entries in data["logs"].items():
            for entry in log_entries:
                log_row = [
                    log_type,
                    entry.get("room", ""),
                    entry.get("name", ""),
                    str(entry.get("amount", 0)),
                    entry.get("time", ""),
                    entry.get("date", ""),
                    entry.get("notes", "")
                ]
                logs_values.append(log_row)
        
        # Clear and update Logs sheet
        sheets_service.spreadsheets().values().clear(
            spreadsheetId=SPREADSHEET_ID, range='Logs!A2:H500').execute()
        
        if logs_values:
            sheets_service.spreadsheets().values().update(
                spreadsheetId=SPREADSHEET_ID, range='Logs!A2',
                valueInputOption='RAW', body={"values": logs_values}).execute()
        
        # ----- SAVE TOTALS DATA -----
        totals_values = [[key, str(value)] for key, value in data["totals"].items()]
        
        sheets_service.spreadsheets().values().clear(
            spreadsheetId=SPREADSHEET_ID, range='Totals!A2:B10').execute()
        
        if totals_values:
            sheets_service.spreadsheets().values().update(
                spreadsheetId=SPREADSHEET_ID, range='Totals!A2',
                valueInputOption='RAW', body={"values": totals_values}).execute()
        
        # ----- SAVE BOOKINGS DATA -----
        bookings_values = []
        for booking_id, booking_info in data.get("bookings", {}).items():
            bookings_values.append([
                booking_id,
                booking_info.get("room", ""),
                booking_info.get("guest_name", ""),
                booking_info.get("guest_mobile", ""),
                booking_info.get("check_in_date", ""),
                booking_info.get("check_out_date", ""),
                booking_info.get("status", ""),
                str(booking_info.get("total_amount", 0)),
                str(booking_info.get("paid_amount", 0)),
                str(booking_info.get("balance", 0)),
                booking_info.get("payment_method", "cash"),
                booking_info.get("notes", ""),
                booking_info.get("photo_path", "")
            ])
        
        sheets_service.spreadsheets().values().clear(
            spreadsheetId=SPREADSHEET_ID, range='Bookings!A2:M500').execute()
        
        if bookings_values:
            sheets_service.spreadsheets().values().update(
                spreadsheetId=SPREADSHEET_ID, range='Bookings!A2',
                valueInputOption='RAW', body={"values": bookings_values}).execute()
        
        logger.info("Data saved to Google Sheets")
        return True
    except Exception as e:
        logger.error(f"Error saving data to Google Sheets: {str(e)}")
        return False

def upload_to_drive(file_path, file_name):
    """Upload a file to Google Drive and return the public link"""
    try:
        _, drive_service = get_google_services()
        if not drive_service:
            raise Exception("Could not connect to Google Drive")
            
        # Prepare file metadata
        file_metadata = {
            'name': file_name,
            'parents': [DRIVE_FOLDER_ID]
        }
        
        # Upload the file
        media = MediaFileUpload(file_path, resumable=True)
        file = drive_service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id,webContentLink').execute()
        
        # Make the file publicly accessible
        permission = {
            'type': 'anyone',
            'role': 'reader'
        }
        drive_service.permissions().create(
            fileId=file.get('id'),
            body=permission).execute()
        
        # Return the public link
        return file.get('webContentLink')
    except Exception as e:
        logger.error(f"Error uploading to Google Drive: {str(e)}")
        return None

# ----- LOAD INITIAL DATA -----
# Load data on startup
data = initialize_data()
rooms = data["rooms"]
logs = data["logs"]
totals = data["totals"]
bookings = data.get("bookings", {})

# ----- ROUTES -----
@app.route("/")
def index():
    """Serve the main page"""
    return render_template("index.html")

@app.route("/static/<path:path>")
def serve_static(path):
    """Serve static files"""
    return send_from_directory("static", path)

@app.route("/uploads/<path:filename>")
def uploaded_file(filename):
    """Serve uploaded files"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route("/upload_photo", methods=["POST"])
def upload_photo():
    """Handle photo uploads and store in Google Drive"""
    if 'photo' not in request.files:
        return jsonify(success=False, message="No file part")
    
    file = request.files['photo']
    
    if file.filename == '':
        return jsonify(success=False, message="No selected file")
    
    if file:
        # Save file locally first
        filename = secure_filename(f"{datetime.now().strftime('%Y%m%d%H%M%S')}-{file.filename}")
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        # Upload to Google Drive
        drive_link = upload_to_drive(file_path, filename)
        
        # Remove local file after upload
        os.remove(file_path)
        
        if drive_link:
            return jsonify(success=True, filename=filename, path=drive_link)
        else:
            return jsonify(success=False, message="Upload to Google Drive failed")
    
    return jsonify(success=False, message="Upload failed")

@app.route("/checkin", methods=["POST"])
def checkin():
    """Handle guest check-in"""
    try:
        data_json = request.json
        room = data_json["room"]
        amount_paid = int(data_json.get("amountPaid", 0))
        price = int(data_json["price"])
        balance = price - amount_paid
        payment = data_json["payment"]
        photo_path = data_json.get("photoPath")
        
        # Validation
        if amount_paid > 0 and payment == "balance":
            return jsonify(success=False, message="Cannot use 'Pay Later' with an amount paid. Please select Cash or Online.")
        
        # Create guest record
        guest = {
            "name": data_json["name"],
            "mobile": data_json["mobile"],
            "price": price,
            "guests": int(data_json["guests"]),
            "payment": payment,
            "balance": balance,
            "photo": photo_path
        }
        
        # Update room data
        rooms[room]["status"] = "occupied"
        rooms[room]["guest"] = guest
        rooms[room]["checkin_time"] = datetime.now().strftime("%Y-%m-%d %H:%M")
        rooms[room]["balance"] = balance
        rooms[room]["add_ons"] = []
        rooms[room]["renewal_count"] = 0
        
        # Log payment if any
        if amount_paid > 0:
            logs[payment].append({
                "room": room, 
                "name": guest["name"], 
                "amount": amount_paid, 
                "time": datetime.now().strftime("%H:%M"),
                "date": datetime.now().strftime("%Y-%m-%d")
            })
            totals[payment] += amount_paid
        
        # Log balance if any
        if balance > 0:
            logs["balance"].append({
                "room": room, 
                "name": guest["name"], 
                "amount": balance,
                "date": datetime.now().strftime("%Y-%m-%d")
            })
            totals["balance"] += balance
        
        # Save to Google Sheets
        save_data({"rooms": rooms, "logs": logs, "totals": totals, "bookings": bookings, 
                  "last_rent_check": data.get("last_rent_check")})
        
        logger.info(f"Check-in successful for room {room}, guest: {guest['name']}")
        return jsonify(success=True, message=f"Check-in successful for {guest['name']}")
    except Exception as e:
        logger.error(f"Error during check-in: {str(e)}")
        return jsonify(success=False, message=f"Error during check-in: {str(e)}")

@app.route("/checkout", methods=["POST"])
def checkout():
    """Handle checkout, payments and refunds"""
    try:
        data_json = request.json
        room = data_json["room"]
        payment_mode = data_json.get("payment_mode")
        amount = int(data_json.get("amount", 0))
        is_refund = data_json.get("is_refund", False)
        is_final_checkout = data_json.get("final_checkout", False)
        process_refund = data_json.get("process_refund", False)
        
        # Handle payment
        if amount > 0 and payment_mode and not is_refund and not process_refund:
            current_balance = rooms[room]["balance"]
            
            # Log the payment
            logs[payment_mode].append({
                "room": room, 
                "name": rooms[room]["guest"]["name"], 
                "amount": amount, 
                "time": datetime.now().strftime("%H:%M"),
                "date": datetime.now().strftime("%Y-%m-%d")
            })
            totals[payment_mode] += amount
            
            # Update balance
            if current_balance > 0:
                if amount >= current_balance:
                    totals["balance"] -= current_balance
                    overpayment = amount - current_balance
                    
                    if overpayment > 0:
                        rooms[room]["balance"] = -overpayment
                        message = f"Payment of ₹{amount} received. Balance cleared. Overpayment: ₹{overpayment}"
                    else:
                        rooms[room]["balance"] = 0
                        message = f"Payment of ₹{amount} received. Balance cleared."
                else:
                    rooms[room]["balance"] -= amount
                    totals["balance"] -= amount
                    message = "Payment recorded successfully."
            else:
                rooms[room]["balance"] -= amount
                message = "Payment recorded successfully."
                
            save_data({"rooms": rooms, "logs": logs, "totals": totals, "bookings": bookings, 
                      "last_rent_check": data.get("last_rent_check")})
            logger.info(f"Payment of ₹{amount} recorded for room {room}")
            
            return jsonify(success=True, message=message)
        
        # Handle refund
        elif process_refund and is_refund and amount > 0:
            current_balance = rooms[room]["balance"]
            
            # Validation
            if abs(current_balance) < amount:
                return jsonify(success=False, 
                    message=f"Refund amount (₹{amount}) exceeds available balance (₹{abs(current_balance)})")
            
            refund_method = payment_mode or "cash"
            guest_name = rooms[room]["guest"]["name"]
            
            # Create refund log
            refund_log = {
                "room": room,
                "name": guest_name,
                "amount": amount,
                "payment_mode": refund_method,
                "time": datetime.now().strftime("%H:%M"),
                "date": datetime.now().strftime("%Y-%m-%d"),
                "note": "Partial refund" if abs(current_balance) > amount else "Full refund"
            }
            
            # Update logs and totals
            if "refunds" not in logs:
                logs["refunds"] = []
            logs["refunds"].append(refund_log)
            
            rooms[room]["balance"] += amount
            
            if "refunds" not in totals:
                totals["refunds"] = 0
            totals["refunds"] += amount
            
            save_data({"rooms": rooms, "logs": logs, "totals": totals, "bookings": bookings, 
                      "last_rent_check": data.get("last_rent_check")})
            logger.info(f"Refund of ₹{amount} processed for room {room}")
            
            return jsonify(success=True, message=f"Refund of ₹{amount} processed successfully")
        
        # Handle final checkout
        elif is_final_checkout:
            balance = rooms[room]["balance"]
            if balance > 0:
                return jsonify(success=False, message="Please clear the balance before checkout")
            
            # Process refund if negative balance
            if balance < 0 and "refund_method" in data_json:
                refund_amount = abs(balance)
                refund_method = data_json.get("refund_method", "cash")
                
                # Log refund
                refund_log = {
                    "room": room,
                    "name": rooms[room]["guest"]["name"],
                    "amount": refund_amount,
                    "payment_mode": refund_method,
                    "time": datetime.now().strftime("%H:%M"),
                    "date": datetime.now().strftime("%Y-%m-%d"),
                    "note": "Checkout refund"
                }
                
                if "refunds" not in logs:
                    logs["refunds"] = []
                logs["refunds"].append(refund_log)
                
                if "refunds" not in totals:
                    totals["refunds"] = 0
                totals["refunds"] += refund_amount
                
                logger.info(f"Checkout refund of ₹{refund_amount} processed for room {room}")
            
            # Clear room data
            guest_name = rooms[room]["guest"]["name"] if rooms[room]["guest"] else "Unknown"
            rooms[room] = {
                "status": "vacant", 
                "guest": None, 
                "checkin_time": None, 
                "balance": 0, 
                "add_ons": []
            }
            
            save_data({"rooms": rooms, "logs": logs, "totals": totals, "bookings": bookings, 
                      "last_rent_check": data.get("last_rent_check")})
            logger.info(f"Room {room} checked out. Guest: {guest_name}")
            
            return jsonify(success=True, message=f"Checkout successful")
        
        # Invalid request
        return jsonify(success=False, message="Invalid request parameters")
            
    except Exception as e:
        logger.error(f"Error during checkout: {str(e)}")
        return jsonify(success=False, message=f"Error during checkout: {str(e)}")

@app.route("/add_on", methods=["POST"])
def add_on():
    """Add a service/item to a room"""
    try:
        data_json = request.json
        room = data_json["room"]
        item = data_json["item"]
        price = int(data_json["price"])
        payment_method = data_json.get("payment_method", "balance")  # Default to balance
        
        # Create add-on entry
        add_on_entry = {
            "room": room, 
            "item": item, 
            "price": price, 
            "time": datetime.now().strftime("%H:%M"),
            "date": datetime.now().strftime("%Y-%m-%d"),
            "payment_method": payment_method
        }
        
        # Handle immediate payment
        if payment_method in ["cash", "online"]:
            logs[payment_method].append({
                "room": room,
                "name": rooms[room]["guest"]["name"],
                "amount": price,
                "time": datetime.now().strftime("%H:%M"),
                "date": datetime.now().strftime("%Y-%m-%d"),
                "item": item,
                "payment_method": payment_method
            })
            totals[payment_method] += price
        else:
            # Add to balance
            rooms[room]["balance"] += price
            totals["balance"] += price
            
            logs["balance"].append({
                "room": room,
                "name": rooms[room]["guest"]["name"],
                "amount": price,
                "time": datetime.now().strftime("%H:%M"),
                "date": datetime.now().strftime("%Y-%m-%d"),
                "item": item,
                "note": f"Added {item} to balance"
            })
        
        # Keep record in room
        rooms[room]["add_ons"].append(add_on_entry)
        
        # Keep central log
        logs["add_ons"].append(add_on_entry)
        
        save_data({"rooms": rooms, "logs": logs, "totals": totals, "bookings": bookings, 
                  "last_rent_check": data.get("last_rent_check")})
        logger.info(f"Add-on '{item}' added to room {room}, price: ₹{price}, payment: {payment_method}")
        
        if payment_method == "balance":
            return jsonify(success=True, message=f"Added {item} (₹{price}) to room {room} balance")
        else:
            return jsonify(success=True, message=f"Added {item} (₹{price}) to room {room}, paid by {payment_method}")
    except Exception as e:
        logger.error(f"Error adding add-on: {str(e)}")
        return jsonify(success=False, message=f"Error adding add-on: {str(e)}")

@app.route("/get_data")
def get_data():
    """Return all data for the frontend"""
    return jsonify(rooms=rooms, logs=logs, totals=totals)

@app.route("/get_history", methods=["POST"])
def get_history():
    """Get transaction history for a specific room and guest"""
    try:
        data_json = request.json
        room = data_json.get("room")
        guest_name = data_json.get("name")
        
        if not room or not guest_name:
            return jsonify(success=False, message="Room and guest name are required.")
        
        # Filter logs for this specific room and guest
        room_cash_logs = [log for log in logs["cash"] if log["room"] == room and log["name"] == guest_name]
        room_online_logs = [log for log in logs["online"] if log["room"] == room and log["name"] == guest_name]
        room_refund_logs = [log for log in logs.get("refunds", []) if log["room"] == room and log["name"] == guest_name]
        room_addons_logs = [log for log in logs.get("add_ons", []) if log["room"] == room]
        room_renewal_logs = [log for log in logs.get("renewals", []) if log["room"] == room and log["name"] == guest_name]
        
        return jsonify(
            success=True, 
            cash=room_cash_logs, 
            online=room_online_logs,
            refunds=room_refund_logs,
            addons=room_addons_logs,
            renewals=room_renewal_logs
        )
    except Exception as e:
        logger.error(f"Error getting history: {str(e)}")
        return jsonify(success=False, message=f"Error retrieving history: {str(e)}")

@app.route("/renew_rent", methods=["POST"])
def renew_rent():
    """Renew rent for a room"""
    try:
        data_json = request.json
        room = data_json["room"]
        
        if room not in rooms or rooms[room]["status"] != "occupied" or not rooms[room]["guest"]:
            return jsonify(success=False, message="Room not occupied.")
        
        guest = rooms[room]["guest"]
        price = guest["price"]
        
        # Add new balance for rent renewal
        rooms[room]["balance"] += price
        totals["balance"] += price
        
        # Update renewal count for tracking
        rooms[room]["renewal_count"] = data_json.get("renewal_count", 0)
        
        # Log the renewal
        renewal_count = rooms[room]["renewal_count"]
        renewal_log = {
            "room": room, 
            "name": guest["name"], 
            "amount": price,
            "time": datetime.now().strftime("%H:%M"),
            "date": datetime.now().strftime("%Y-%m-%d"),
            "note": f"Day {renewal_count + 1} rent renewal",
            "day": renewal_count + 1
        }
        
        logs["balance"].append(renewal_log)
        
        if "renewals" in logs:
            logs["renewals"].append(renewal_log)
        
        save_data({"rooms": rooms, "logs": logs, "totals": totals, "bookings": bookings, 
                  "last_rent_check": datetime.now().strftime("%Y-%m-%d %H:%M:%S")})
        logger.info(f"Rent renewed for Room {room}, Day {renewal_count + 1}")
        
        return jsonify(success=True, message=f"Rent renewed for Room {room}")
    except Exception as e:
        logger.error(f"Error renewing rent: {str(e)}")
        return jsonify(success=False, message=f"Error renewing rent: {str(e)}")

@app.route("/update_checkin_time", methods=["POST"])
def update_checkin_time():
    """Update the check-in time for a room"""
    try:
        data_json = request.json
        room = data_json["room"]
        new_checkin_time = data_json["checkin_time"]
        
        if room not in rooms or rooms[room]["status"] != "occupied":
            return jsonify(success=False, message="Room not found or not occupied.")
        
        # Reset renewal data
        rooms[room]["renewal_count"] = 0
        
        # Validate the new time
        datetime.strptime(new_checkin_time, "%Y-%m-%d %H:%M")
        
        # Update the checkin time
        rooms[room]["checkin_time"] = new_checkin_time
        
        save_data({"rooms": rooms, "logs": logs, "totals": totals, "bookings": bookings, 
                  "last_rent_check": data.get("last_rent_check")})
        logger.info(f"Check-in time updated for room {room}: {new_checkin_time}")
        
        return jsonify(success=True, message="Check-in time updated successfully.")
    except Exception as e:
        logger.error(f"Error updating check-in time: {str(e)}")
        return jsonify(success=False, message=f"Error updating check-in time: {str(e)}")

@app.route("/get_room_numbers", methods=["GET"])
def get_room_numbers():
    """Get all room numbers for the frontend"""
    try:
        # Return a list of all room numbers for autocomplete
        room_numbers = list(rooms.keys())
        
        # Sort rooms by floor and number
        def room_sort_key(room_num):
            # Second floor rooms (start with 2)
            if room_num.startswith('2'):
                return 2, int(room_num)
            # First floor rooms
            else:
                return 1, int(room_num)
        
        room_numbers.sort(key=room_sort_key)
        
        # Group by floor
        first_floor = [r for r in room_numbers if not r.startswith('2')]
        second_floor = [r for r in room_numbers if r.startswith('2')]
        
        return jsonify(
            success=True,
            rooms=room_numbers,
            first_floor=first_floor,
            second_floor=second_floor
        )
    except Exception as e:
        logger.error(f"Error retrieving room numbers: {str(e)}")
        return jsonify(success=False, message=f"Error retrieving room numbers: {str(e)}")

# Include other routes (add_room, apply_discount, transfer_room, etc.)
# The implementation follows the same pattern as the routes above

# ----- START THE APP -----
if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)