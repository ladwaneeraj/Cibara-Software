from flask import Flask, render_template, request, jsonify, send_from_directory
from datetime import datetime, timedelta
import json
import os
import logging
import uuid
from werkzeug.utils import secure_filename
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]  # Only log to console on Render
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__, static_folder='static')

# Google API settings - DEFINE SCOPES BEFORE USING THEM
SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
SPREADSHEET_ID = '1oQhNGbuzad2XC9kQwXu2CswaHlxLHhHKgngz1wA9iRo'  # Replace with yours
DRIVE_FOLDER_ID = '1P4f1lx9w5ay-3Dw4JO3qzjGN8ysTvGt5'  # Replace with yours

# Try to get credentials from environment variable
try:
    google_credentials = os.environ.get('GOOGLE_CREDENTIALS')
    if google_credentials:
        logger.info("Using Google credentials from environment variable")
        credentials_info = json.loads(google_credentials)
        credentials = service_account.Credentials.from_service_account_info(
            credentials_info, scopes=SCOPES)
    else:
        # Fall back to file if environment variable is not set
        logger.info("Environment variable GOOGLE_CREDENTIALS not found, trying file")
        SERVICE_ACCOUNT_FILE = 'lodge-service-account.json'
        if os.path.exists(SERVICE_ACCOUNT_FILE):
            credentials = service_account.Credentials.from_service_account_file(
                SERVICE_ACCOUNT_FILE, scopes=SCOPES)
        else:
            logger.error(f"Service account file {SERVICE_ACCOUNT_FILE} not found")
            credentials = None
except Exception as e:
    logger.error(f"Error loading Google credentials: {str(e)}")
    credentials = None

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

# Updated photo upload function with better error handling and debugging

@app.route("/upload_photo", methods=["POST"])
def upload_photo():
    """Handle photo uploads and store in Google Drive with enhanced error handling"""
    logger.info("Processing photo upload request")
    
    if 'photo' not in request.files:
        logger.warning("No file part in the request")
        return jsonify(success=False, message="No file part")
    
    file = request.files['photo']
    
    if file.filename == '':
        logger.warning("No selected file")
        return jsonify(success=False, message="No selected file")
    
    if file:
        try:
            # Create uploads directory if it doesn't exist
            if not os.path.exists(app.config['UPLOAD_FOLDER']):
                logger.info(f"Creating uploads directory: {app.config['UPLOAD_FOLDER']}")
                os.makedirs(app.config['UPLOAD_FOLDER'])
            
            # Save file locally first
            filename = secure_filename(f"{datetime.now().strftime('%Y%m%d%H%M%S')}-{file.filename}")
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            
            logger.info(f"Saving uploaded file temporarily to {file_path}")
            file.save(file_path)
            
            # Check if file was saved successfully
            if not os.path.exists(file_path):
                logger.error(f"Failed to save file to {file_path}")
                return jsonify(success=False, message="Failed to save uploaded file")
            
            logger.info(f"File saved successfully, size: {os.path.getsize(file_path)} bytes")
            
            # Upload to Google Drive
            logger.info(f"Uploading file to Google Drive: {filename}")
            drive_link = upload_to_drive(file_path, filename)
            
            if drive_link:
                logger.info(f"Upload to Google Drive successful: {drive_link}")
                # Remove local file after upload
                try:
                    os.remove(file_path)
                    logger.info(f"Removed temporary file: {file_path}")
                except Exception as e:
                    logger.warning(f"Failed to remove temporary file {file_path}: {str(e)}")
                
                return jsonify(success=True, filename=filename, path=drive_link)
            else:
                logger.error("Upload to Google Drive failed")
                return jsonify(success=False, message="Upload to Google Drive failed")
        
        except Exception as e:
            logger.error(f"Error processing photo upload: {str(e)}")
            return jsonify(success=False, message=f"Error processing photo: {str(e)}")
    
    return jsonify(success=False, message="Upload failed")

def upload_to_drive(file_path, file_name):
    """Upload a file to Google Drive with enhanced error handling and debugging"""
    logger.info(f"Starting upload to Drive: {file_name}")
    
    try:
        # Get Google Drive service
        _, drive_service = get_google_services()
        
        if not drive_service:
            logger.error("Failed to initialize Google Drive service")
            return None
            
        # Verify Drive folder exists
        try:
            folder = drive_service.files().get(fileId=DRIVE_FOLDER_ID).execute()
            logger.info(f"Target Drive folder verified: {folder.get('name', 'unknown')}")
        except Exception as e:
            logger.error(f"Error verifying Drive folder {DRIVE_FOLDER_ID}: {str(e)}")
            return None
        
        # Prepare file metadata
        file_metadata = {
            'name': file_name,
            'parents': [DRIVE_FOLDER_ID]
        }
        
        # Check if file exists
        if not os.path.exists(file_path):
            logger.error(f"File not found: {file_path}")
            return None
            
        logger.info(f"Uploading file {file_path} to Drive folder {DRIVE_FOLDER_ID}")
        
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
        
        logger.info(f"Setting public permission for file ID: {file.get('id')}")
        drive_service.permissions().create(
            fileId=file.get('id'),
            body=permission).execute()
        
        # Return the public link
        logger.info(f"Upload successful, webContentLink: {file.get('webContentLink')}")
        return file.get('webContentLink')
    
    except Exception as e:
        logger.error(f"Error uploading to Google Drive: {str(e)}")
        return None
    
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

@app.route("/add_room", methods=["POST"])
def add_room():
    try:
        data_json = request.json
        room_number = data_json.get("roomNumber")
        
        if not room_number:
            return jsonify(success=False, message="Room number is required")
            
        if room_number in rooms:
            return jsonify(success=False, message=f"Room {room_number} already exists")
            
        # Add the new room
        rooms[room_number] = {"status": "vacant", "guest": None, "checkin_time": None, "balance": 0, "add_ons": []}
        
        save_data({"rooms": rooms, "logs": logs, "totals": totals, "last_rent_check": data.get("last_rent_check")})
        logger.info(f"New room {room_number} added")
        return jsonify(success=True, message=f"Room {room_number} added successfully")
        
    except Exception as e:
        logger.error(f"Error adding new room: {str(e)}")
        return jsonify(success=False, message=f"Error adding new room: {str(e)}")


@app.route("/apply_discount", methods=["POST"])
def apply_discount():
    try:
        data_json = request.json
        room = data_json["room"]
        amount = int(data_json.get("amount", 0))
        reason = data_json.get("reason", "Discount")
        
        if room not in rooms:
            return jsonify(success=False, message="Room not found.")
            
        if rooms[room]["status"] != "occupied":
            return jsonify(success=False, message="Room is not occupied.")
        
        if amount <= 0:
            return jsonify(success=False, message="Please provide a valid discount amount.")
        
        # Create discount entry
        discount_entry = {
            "amount": amount,
            "reason": reason,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "time": datetime.now().strftime("%H:%M")
        }
        
        # Initialize discounts array if it doesn't exist
        if "discounts" not in rooms[room]:
            rooms[room]["discounts"] = []
        
        # Add discount to room
        rooms[room]["discounts"].append(discount_entry)
        
        # Adjust balance
        if rooms[room]["balance"] > 0:
            # Only reduce balance if there is an outstanding amount
            rooms[room]["balance"] = max(0, rooms[room]["balance"] - amount)
            
            # Adjust totals
            if "balance" in totals:
                totals["balance"] = max(0, totals["balance"] - amount)
        else:
            # If balance is already paid or negative (refund due), 
            # create a negative balance (additional refund)
            rooms[room]["balance"] -= amount
        
        # Log the discount
        if "discounts" not in logs:
            logs["discounts"] = []
            
        logs["discounts"].append({
            "room": room,
            "name": rooms[room]["guest"]["name"],
            "amount": amount,
            "reason": reason,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "time": datetime.now().strftime("%H:%M")
        })
        
        # Save data
        save_data({"rooms": rooms, "logs": logs, "totals": totals, "last_rent_check": data.get("last_rent_check")})
        logger.info(f"Discount of ₹{amount} applied to room {room}, reason: {reason}")
        
        return jsonify(success=True, message=f"Discount of ₹{amount} applied successfully.")
    except Exception as e:
        logger.error(f"Error applying discount: {str(e)}")
        return jsonify(success=False, message=f"Error applying discount: {str(e)}")
    
@app.route("/transfer_room", methods=["POST"])
def transfer_room():
    try:
        data_json = request.json
        old_room = str(data_json["old_room"])  # Convert to string
        new_room = str(data_json["new_room"])  # Convert to string
        
        # Check if both rooms exist and conditions are met
        if old_room not in rooms or new_room not in rooms:
            return jsonify(success=False, message="One or both rooms do not exist.")
            
        if rooms[old_room]["status"] != "occupied":
            return jsonify(success=False, message="Source room is not occupied.")
            
        if rooms[new_room]["status"] != "vacant":
            return jsonify(success=False, message="Destination room is not vacant.")
        
        # Store guest name before transfer
        guest_name = rooms[old_room]["guest"]["name"]
        
        # Transfer guest data
        rooms[new_room] = rooms[old_room].copy()
        
        # Clear old room
        rooms[old_room] = {"status": "vacant", "guest": None, "checkin_time": None, "balance": 0, "add_ons": []}
        
        # Update log entries to point to the new room
        for log_type in ["cash", "online", "balance", "add_ons", "refunds", "renewals"]:
            if log_type in logs:
                for log in logs[log_type]:
                    if log["room"] == old_room and log["name"] == guest_name:
                        log["room"] = new_room
                        log["room_shifted"] = True
                        log["old_room"] = old_room
        
        # Record the room shift event
        shift_log = {
            "room": new_room,
            "name": guest_name,
            "old_room": old_room,
            "time": datetime.now().strftime("%H:%M"),
            "date": datetime.now().strftime("%Y-%m-%d"),
            "note": f"Transferred from Room {old_room} to Room {new_room}"
        }
        
        # Create a room_shifts log if it doesn't exist
        if "room_shifts" not in logs:
            logs["room_shifts"] = []
            
        logs["room_shifts"].append(shift_log)
        
        # Save the updated data
        save_data({"rooms": rooms, "logs": logs, "totals": totals, "last_rent_check": data.get("last_rent_check")})
        
        return jsonify(
            success=True, 
            message=f"Guest transferred from Room {old_room} to Room {new_room} successfully."
        )
        
    except Exception as e:
        logger.error(f"Error transferring room: {str(e)}", exc_info=True)
        return jsonify(success=False, message=f"Error transferring room: {str(e)}")

# Add these endpoints to app.py

@app.route("/add_expense", methods=["POST"])
def add_expense():
    try:
        data_json = request.json
        date = data_json.get("date")
        category = data_json.get("category")
        description = data_json.get("description")
        amount = int(data_json.get("amount", 0))
        payment_method = data_json.get("payment_method", "cash")
        expense_type = data_json.get("type", "transaction")  # "transaction" or "report"
        
        if not date or not category or not description or amount <= 0 or not payment_method:
            return jsonify(success=False, message="All fields are required")
        
        # Ensure expenses log exists
        if "expenses" not in logs:
            logs["expenses"] = []
        
        # Create expense entry
        expense_entry = {
            "date": date,
            "category": category,
            "description": description,
            "amount": amount,
            "payment_method": payment_method,
            "expense_type": expense_type,
            "time": datetime.now().strftime("%H:%M")
        }
        
        # Add to expenses log
        logs["expenses"].append(expense_entry)
        
        # Only transaction expenses affect daily totals
        if expense_type == "transaction":
            # Ensure expenses total exists
            if "expenses" not in totals:
                totals["expenses"] = 0
                
            # Update total expenses
            totals["expenses"] += amount
        
        save_data({"rooms": rooms, "logs": logs, "totals": totals, "last_rent_check": data.get("last_rent_check")})
        
        # Log the expense
        logger.info(f"Expense added: {description}, Category: {category}, Amount: ₹{amount}, Type: {expense_type}")
        
        return jsonify(success=True, message=f"Expense of ₹{amount} added successfully")
    except Exception as e:
        logger.error(f"Error adding expense: {str(e)}")
        return jsonify(success=False, message=f"Error adding expense: {str(e)}")

# Update the reports endpoint to include expenses
@app.route("/reports", methods=["POST"])
def get_reports():
    try:
        data_json = request.json
        start_date = data_json.get("start_date")
        end_date = data_json.get("end_date")
        
        if not start_date or not end_date:
            return jsonify(success=False, message="Start and end dates are required.")
        
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)  # Include end date
        
        # Filter logs by date range
        cash_logs = [log for log in logs["cash"] if start <= datetime.strptime(log.get("date", "1970-01-01"), "%Y-%m-%d") < end]
        online_logs = [log for log in logs["online"] if start <= datetime.strptime(log.get("date", "1970-01-01"), "%Y-%m-%d") < end]
        add_on_logs = [log for log in logs["add_ons"] if start <= datetime.strptime(log.get("date", "1970-01-01"), "%Y-%m-%d") < end]
        refund_logs = [log for log in logs.get("refunds", []) if start <= datetime.strptime(log.get("date", "1970-01-01"), "%Y-%m-%d") < end]
        renewal_logs = [log for log in logs.get("renewals", []) if start <= datetime.strptime(log.get("date", "1970-01-01"), "%Y-%m-%d") < end]
        
        # Filter expense logs
        expense_logs = logs.get("expenses", [])
        filtered_expense_logs = [log for log in expense_logs if start <= datetime.strptime(log.get("date", "1970-01-01"), "%Y-%m-%d") < end]
        
        # Calculate summaries
        cash_total = sum(log["amount"] for log in cash_logs)
        online_total = sum(log["amount"] for log in online_logs)
        addon_total = sum(log["price"] for log in add_on_logs)
        refund_total = sum(log["amount"] for log in refund_logs)
        
        # Calculate expense totals
        transaction_expense_total = sum(log["amount"] for log in filtered_expense_logs if log.get("expense_type") == "transaction")
        report_expense_total = sum(log["amount"] for log in filtered_expense_logs if log.get("expense_type") == "report")
        total_expense = transaction_expense_total + report_expense_total
        
        # Count check-ins during this period
        checkins = 0
        renewals = len(renewal_logs)
        
        # Proper way to count check-ins from existing rooms
        for room_info in rooms.values():
            if room_info["checkin_time"]:
                try:
                    checkin_date = datetime.strptime(room_info["checkin_time"].split(" ")[0], "%Y-%m-%d")
                    if start <= checkin_date < end:
                        checkins += 1
                except Exception as e:
                    logger.error(f"Error parsing checkin date: {str(e)}")
        
        return jsonify(
            success=True,
            cash_total=cash_total,
            online_total=online_total,
            addon_total=addon_total,
            refund_total=refund_total,
            expense_total=total_expense,
            transaction_expense_total=transaction_expense_total,
            report_expense_total=report_expense_total,
            total_revenue=cash_total + online_total - refund_total - transaction_expense_total,
            checkins=checkins,
            renewals=renewals,
            cash_logs=cash_logs,
            online_logs=online_logs,
            addon_logs=add_on_logs,
            refund_logs=refund_logs,
            renewal_logs=renewal_logs,
            expense_logs=filtered_expense_logs
        )
    
    except Exception as e:
        logger.error(f"Error generating report: {str(e)}")
        return jsonify(success=False, message=f"Error generating report: {str(e)}")
    
# Get all future bookings
@app.route("/get_bookings", methods=["GET"])
def get_bookings():
    try:
        # Load bookings from data
        bookings = data.get("bookings", {})
        
        # Convert to list for easier frontend handling
        bookings_list = []
        for booking_id, booking in bookings.items():
            booking_copy = booking.copy()
            booking_copy["booking_id"] = booking_id
            bookings_list.append(booking_copy)
        
        # Sort by check-in date (most recent first)
        bookings_list.sort(key=lambda b: b.get("check_in_date", ""), reverse=True)
        
        return jsonify(success=True, bookings=bookings_list)
    except Exception as e:
        logger.error(f"Error getting bookings: {str(e)}")
        return jsonify(success=False, message=f"Error getting bookings: {str(e)}")

# Create a new booking
@app.route("/create_booking", methods=["POST"])
def create_booking():
    try:
        booking_data = request.json
        
        # Validate required fields
        required_fields = ["room", "guest_name", "guest_mobile", "check_in_date", "check_out_date", "total_amount"]
        for field in required_fields:
            if field not in booking_data:
                return jsonify(success=False, message=f"Missing required field: {field}")
        
        # Generate a unique booking ID
        booking_id = str(uuid.uuid4())
        
        # Initialize booking structure
        booking = {
            "room": booking_data["room"],
            "guest_name": booking_data["guest_name"],
            "guest_mobile": booking_data["guest_mobile"],
            "booking_date": datetime.now().strftime("%Y-%m-%d"),
            "check_in_date": booking_data["check_in_date"],
            "check_out_date": booking_data["check_out_date"],
            "status": "confirmed",
            "total_amount": int(booking_data["total_amount"]),
            "paid_amount": int(booking_data.get("paid_amount", 0)),
            "balance": int(booking_data["total_amount"]) - int(booking_data.get("paid_amount", 0)),
            "payment_method": booking_data.get("payment_method", "cash"),
            "notes": booking_data.get("notes", ""),
            "photo_path": booking_data.get("photo_path", None),
            "guest_count": int(booking_data.get("guest_count", 1))
        }
        
        # Handle partial payment logging if amount is paid
        paid_amount = int(booking_data.get("paid_amount", 0))
        if paid_amount > 0:
            payment_method = booking_data.get("payment_method", "cash")
            
            # Add to payment logs
            logs[payment_method].append({
                "booking_id": booking_id,
                "room": booking["room"],
                "name": booking["guest_name"],
                "amount": paid_amount,
                "time": datetime.now().strftime("%H:%M"),
                "date": datetime.now().strftime("%Y-%m-%d"),
                "type": "booking_advance"
            })
            
            # Add to booking payments log specifically
            logs["booking_payments"].append({
                "booking_id": booking_id,
                "room": booking["room"],
                "name": booking["guest_name"],
                "amount": paid_amount,
                "payment_method": payment_method,
                "time": datetime.now().strftime("%H:%M"),
                "date": datetime.now().strftime("%Y-%m-%d"),
                "type": "advance"
            })
            
            # Update totals
            totals[payment_method] += paid_amount
            totals["advance_bookings"] += paid_amount
        
        # Add booking to data structure
        if "bookings" not in data:
            data["bookings"] = {}
        
        data["bookings"][booking_id] = booking
        
        # Save data
        save_data(data)
        
        logger.info(f"Booking created: {booking_id} for {booking['guest_name']}")
        return jsonify(success=True, booking_id=booking_id, message="Booking created successfully")
        
    except Exception as e:
        logger.error(f"Error creating booking: {str(e)}")
        return jsonify(success=False, message=f"Error creating booking: {str(e)}")

# Update an existing booking
@app.route("/update_booking", methods=["POST"])
def update_booking():
    try:
        booking_data = request.json
        booking_id = booking_data.get("booking_id")
        
        if not booking_id or booking_id not in data.get("bookings", {}):
            return jsonify(success=False, message="Invalid booking ID")
        
        # Get the existing booking
        booking = data["bookings"][booking_id]
        
        # Check if there's a new payment to process
        new_payment_amount = int(booking_data.get("new_payment", 0))
        if new_payment_amount > 0:
            payment_method = booking_data.get("payment_method", "cash")
            
            # Add to payment logs
            logs[payment_method].append({
                "booking_id": booking_id,
                "room": booking["room"],
                "name": booking["guest_name"],
                "amount": new_payment_amount,
                "time": datetime.now().strftime("%H:%M"),
                "date": datetime.now().strftime("%Y-%m-%d"),
                "type": "booking_payment"
            })
            
            # Add to booking payments log specifically
            logs["booking_payments"].append({
                "booking_id": booking_id,
                "room": booking["room"],
                "name": booking["guest_name"],
                "amount": new_payment_amount,
                "payment_method": payment_method,
                "time": datetime.now().strftime("%H:%M"),
                "date": datetime.now().strftime("%Y-%m-%d"),
                "type": "additional_payment"
            })
            
            # Update totals
            totals[payment_method] += new_payment_amount
            totals["advance_bookings"] += new_payment_amount
            
            # Update booking paid amount and balance
            booking["paid_amount"] += new_payment_amount
            booking["balance"] = booking["total_amount"] - booking["paid_amount"]
        
        # Update fields that can be modified
        updatable_fields = [
            "guest_name", "guest_mobile", "check_in_date", "check_out_date", 
            "room", "notes", "guest_count", "total_amount"
        ]
        
        for field in updatable_fields:
            if field in booking_data:
                booking[field] = booking_data[field]
        
        # Recalculate balance if total amount was updated
        if "total_amount" in booking_data:
            booking["total_amount"] = int(booking_data["total_amount"])
            booking["balance"] = booking["total_amount"] - booking["paid_amount"]
            
        # Update status if provided
        if "status" in booking_data:
            booking["status"] = booking_data["status"]
        
        # Save data
        save_data(data)
        
        logger.info(f"Booking updated: {booking_id}")
        return jsonify(success=True, booking=booking, message="Booking updated successfully")
        
    except Exception as e:
        logger.error(f"Error updating booking: {str(e)}")
        return jsonify(success=False, message=f"Error updating booking: {str(e)}")

# Cancel a booking
@app.route("/cancel_booking", methods=["POST"])
def cancel_booking():
    try:
        booking_data = request.json
        booking_id = booking_data.get("booking_id")
        
        if not booking_id or booking_id not in data.get("bookings", {}):
            return jsonify(success=False, message="Invalid booking ID")
        
        # Get the booking
        booking = data["bookings"][booking_id]
        
        # Process refund if requested
        refund_amount = int(booking_data.get("refund_amount", 0))
        if refund_amount > 0:
            refund_method = booking_data.get("refund_method", "cash")
            
            # Log the refund
            logs["refunds"].append({
                "booking_id": booking_id,
                "room": booking["room"],
                "name": booking["guest_name"],
                "amount": refund_amount,
                "time": datetime.now().strftime("%H:%M"),
                "date": datetime.now().strftime("%Y-%m-%d"),
                "payment_mode": refund_method,
                "note": "Booking cancellation refund"
            })
            
            # Update total refunds
            totals["refunds"] += refund_amount
            
            # Update booking paid amount and balance
            booking["paid_amount"] -= refund_amount
            booking["balance"] = booking["total_amount"] - booking["paid_amount"]
        
        # Update booking status
        booking["status"] = "cancelled"
        booking["cancellation_date"] = datetime.now().strftime("%Y-%m-%d")
        booking["cancellation_reason"] = booking_data.get("reason", "")
        
        # Save data
        save_data(data)
        
        logger.info(f"Booking cancelled: {booking_id}")
        return jsonify(success=True, message="Booking cancelled successfully")
        
    except Exception as e:
        logger.error(f"Error cancelling booking: {str(e)}")
        return jsonify(success=False, message=f"Error cancelling booking: {str(e)}")

# Convert a booking to check-in
@app.route("/convert_booking_to_checkin", methods=["POST"])
def convert_booking_to_checkin():
    try:
        booking_data = request.json
        booking_id = booking_data.get("booking_id")
        
        if not booking_id or booking_id not in data.get("bookings", {}):
            return jsonify(success=False, message="Invalid booking ID")
        
        # Get the booking
        booking = data["bookings"][booking_id]
        
        # Check if the room is currently vacant
        room_number = booking["room"]
        if room_number not in rooms or rooms[room_number]["status"] != "vacant":
            return jsonify(success=False, message=f"Room {room_number} is not vacant")
        
        # Process remaining payment if provided
        remaining_payment = int(booking_data.get("remaining_payment", 0))
        payment_method = booking_data.get("payment_method", "cash")
        balance_after_payment = booking["balance"] - remaining_payment
        
        if remaining_payment > 0:
            # Add payment to logs
            logs[payment_method].append({
                "booking_id": booking_id,
                "room": booking["room"],
                "name": booking["guest_name"],
                "amount": remaining_payment,
                "time": datetime.now().strftime("%H:%M"),
                "date": datetime.now().strftime("%Y-%m-%d"),
                "type": "booking_final_payment"
            })
            
            # Add to booking payments log
            logs["booking_payments"].append({
                "booking_id": booking_id,
                "room": booking["room"],
                "name": booking["guest_name"],
                "amount": remaining_payment,
                "payment_method": payment_method,
                "time": datetime.now().strftime("%H:%M"),
                "date": datetime.now().strftime("%Y-%m-%d"),
                "type": "final_payment"
            })
            
            # Update totals
            totals[payment_method] += remaining_payment
        
        # Create guest object for check-in
        guest = {
            "name": booking["guest_name"],
            "mobile": booking["guest_mobile"],
            "price": int(booking_data.get("room_price", booking["total_amount"])),
            "guests": booking["guest_count"],
            "payment": payment_method,
            "balance": balance_after_payment if balance_after_payment > 0 else 0,
            "photo": booking.get("photo_path")
        }
        
        # Update room to occupied
        rooms[room_number]["status"] = "occupied"
        rooms[room_number]["guest"] = guest
        rooms[room_number]["checkin_time"] = datetime.now().strftime("%Y-%m-%d %H:%M")
        rooms[room_number]["balance"] = balance_after_payment if balance_after_payment > 0 else 0
        rooms[room_number]["add_ons"] = []
        rooms[room_number]["renewal_count"] = 0
        rooms[room_number]["last_renewal_time"] = None
        
        # If there's still balance, add to balance log
        if balance_after_payment > 0:
            logs["balance"].append({
                "room": room_number,
                "name": guest["name"],
                "amount": balance_after_payment,
                "date": datetime.now().strftime("%Y-%m-%d"),
                "note": "Remaining balance from booking"
            })
            totals["balance"] += balance_after_payment
        
        # Update booking status
        booking["status"] = "checked_in"
        booking["check_in_time"] = datetime.now().strftime("%Y-%m-%d %H:%M")
        
        # Save data
        save_data(data)
        
        logger.info(f"Booking {booking_id} converted to check-in for room {room_number}")
        return jsonify(success=True, message=f"Guest checked in to Room {room_number}")
        
    except Exception as e:
        logger.error(f"Error converting booking to check-in: {str(e)}")
        return jsonify(success=False, message=f"Error converting booking to check-in: {str(e)}")

@app.route("/check_availability", methods=["POST"])
def check_availability():
    try:
        request_data = request.json
        check_in_date = request_data.get("check_in_date")
        check_out_date = request_data.get("check_out_date")
        
        if not check_in_date or not check_out_date:
            return jsonify(success=False, message="Check-in and check-out dates are required")
        
        # Parse dates
        try:
            check_in = datetime.strptime(check_in_date, "%Y-%m-%d")
            check_out = datetime.strptime(check_out_date, "%Y-%m-%d")
        except ValueError:
            return jsonify(success=False, message="Invalid date format. Use YYYY-MM-DD")
        
        # Get all bookings that overlap with the requested date range
        bookings = data.get("bookings", {})
        booked_rooms = set()
        
        for booking_id, booking in bookings.items():
            # Skip cancelled bookings
            if booking.get("status") == "cancelled":
                continue
                
            # Skip checked-in bookings
            if booking.get("status") == "checked_in":
                continue
                
            # Parse booking dates
            booking_check_in = datetime.strptime(booking["check_in_date"], "%Y-%m-%d")
            booking_check_out = datetime.strptime(booking["check_out_date"], "%Y-%m-%d")
            
            # Check if there's any overlap in the date ranges
            if (check_in < booking_check_out and check_out > booking_check_in):
                booked_rooms.add(booking["room"])
        
        # For current occupancy, ONLY exclude rooms if check-in date is TODAY
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        if check_in.date() == today.date():
            # Only check currently occupied rooms if check-in is today
            for room_number, room_info in rooms.items():
                if room_info["status"] == "occupied":
                    booked_rooms.add(room_number)
        
        # Compile available rooms (all rooms except those already booked for the requested dates)
        available_rooms = []
        for room_number in rooms.keys():
            if room_number not in booked_rooms:
                available_rooms.append(room_number)
        
        # Sort room numbers
        available_rooms.sort(key=lambda r: (int(r) if r.isdigit() else float('inf'), r))
        
        return jsonify(success=True, available_rooms=available_rooms)
        
    except Exception as e:
        logger.error(f"Error checking availability: {str(e)}")
        return jsonify(success=False, message=f"Error checking availability: {str(e)}")
    
# Add this to app.py - Enhanced Google API Authentication

# Improved Google credentials handling
def setup_google_credentials():
    """Initialize and validate Google API credentials with enhanced error logging"""
    logger.info("Setting up Google API credentials...")
    
    try:
        # Try environment variable first
        google_credentials = os.environ.get('GOOGLE_CREDENTIALS')
        if google_credentials:
            logger.info("Using Google credentials from environment variable")
            try:
                credentials_info = json.loads(google_credentials)
                credentials = service_account.Credentials.from_service_account_info(
                    credentials_info, scopes=SCOPES)
                logger.info("Successfully loaded credentials from environment variable")
                return credentials
            except json.JSONDecodeError:
                logger.error("Failed to parse GOOGLE_CREDENTIALS environment variable: Invalid JSON")
            except Exception as e:
                logger.error(f"Error creating credentials from environment variable: {str(e)}")
        
        # Fall back to file
        logger.info("Trying to load credentials from service account file")
        SERVICE_ACCOUNT_FILE = 'lodge-service-account.json'
        if os.path.exists(SERVICE_ACCOUNT_FILE):
            try:
                credentials = service_account.Credentials.from_service_account_file(
                    SERVICE_ACCOUNT_FILE, scopes=SCOPES)
                logger.info(f"Successfully loaded credentials from {SERVICE_ACCOUNT_FILE}")
                return credentials
            except Exception as e:
                logger.error(f"Error loading credentials from file: {str(e)}")
        else:
            logger.error(f"Service account file {SERVICE_ACCOUNT_FILE} not found")
        
        logger.critical("No valid Google credentials found. API functionality will be disabled.")
        return None
    except Exception as e:
        logger.critical(f"Unexpected error setting up Google credentials: {str(e)}")
        return None

# Use this to get services with proper error handling
def get_google_services():
    """Initialize and return Google Sheets and Drive services with better error handling"""
    try:
        credentials = setup_google_credentials()
        if not credentials:
            logger.error("Failed to obtain valid credentials")
            return None, None
        
        logger.info("Initializing Google API services...")
        try:
            sheets_service = build('sheets', 'v4', credentials=credentials)
            logger.info("Successfully initialized Google Sheets service")
        except Exception as e:
            logger.error(f"Failed to build Sheets service: {str(e)}")
            sheets_service = None
            
        try:
            drive_service = build('drive', 'v3', credentials=credentials)
            logger.info("Successfully initialized Google Drive service")
        except Exception as e:
            logger.error(f"Failed to build Drive service: {str(e)}")
            drive_service = None
            
        return sheets_service, drive_service
    except Exception as e:
        logger.error(f"Error connecting to Google services: {str(e)}")
        return None, None

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)