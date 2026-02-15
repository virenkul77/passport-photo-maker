EASY PASSPORT PHOTO MAKER
================================================================================
Create Professional 4×6 Passport Photo Sheets — Fast & Simple

PROJECT OVERVIEW
================================================================================
The Easy Passport Photo Maker is a web-based application that helps you create
professional passport photos on standard 4×6 inch sheets. The application 
features:

• Automatic background removal using advanced AI (rembg library)
• Smart photo cropping and alignment
• Multiple passport photos arranged on a single sheet
• High-quality output (300 DPI)
• White background composition
• Preview before downloading
• Simple, intuitive web interface


FEATURES
================================================================================
1. Photo Upload & Selection
   - Upload your own photos
   - Select previously uploaded photos from the uploads folder
   - Support for common image formats (JPEG, PNG, etc.)

2. Photo Editing
   - Crop photos to desired aspect ratio
   - Reset to original state
   - Real-time preview of changes

3. Background Removal
   - Automatic background detection and removal
   - White background replacement for professional appearance
   - EXIF orientation detection and correction

4. Passport Photo Generation
   - Generates standard 4×6 inch sheets with multiple photos
   - 300 DPI output for print quality
   - Grid layout for efficient paper usage
   - Multiple download formats

5. Preview & Download
   - Real-time preview of generated photos
   - Download as PDF or image file


SYSTEM REQUIREMENTS
================================================================================
• macOS operating system
• Python 3.7 or higher
• 4GB RAM minimum (8GB recommended for smooth processing)
• Modern web browser (Chrome, Firefox, Safari, Edge)
• Internet connection (for first-time dependency downloads)
• Not tested on Windows, however will work.


INSTALLATION & SETUP
================================================================================

QUICK START (Automated Setup):
-------------------------------
1. Open Terminal and navigate to the application folder:
   cd /Users/<user name>/Utils/PassportPhoto

2. Run the setup script:
   bash setpup.sh

   This script will:
   • Create a Python virtual environment
   • Install all required dependencies
   • Start the Flask development server

MANUAL SETUP:
-------------
If you prefer to set up manually:

1. Create a virtual environment:
   python3 -m venv venv

2. Activate the virtual environment:
   source venv/bin/activate

3. Install dependencies:
   pip3 install flask pillow rembg numpy torch transformers opencv-python onnxruntime

4. Start the application:
   export FLASK_APP=app.py
   export FLASK_ENV=development
   python3 app.py

5. Open your browser and navigate to:
   http://localhost:5000


DEPENDENCIES
================================================================================
The application requires the following Python packages:

• Flask 3.1.2 - Web framework
• Pillow 12.0.0 - Image processing
• rembg 2.0.67 - AI-powered background removal
• PyTorch 2.2.2 - Deep learning framework
• Transformers 4.57.1 - Pre-trained models for background detection
• OpenCV 4.12.0.88 - Computer vision processing
• NumPy 2.2.6 - Numerical computing
• ONNX Runtime 1.19.2 - Model inference

For a complete list of dependencies, see requirements.txt


FILE STRUCTURE
================================================================================
PassportPhoto/
├── app.py                 - Main Flask application
├── requirements.txt       - Python dependencies list
├── setpup.sh             - Automated setup script
├── setpup-back.sh        - Backup setup script
├── README.txt            - This file
├── static/
│   ├── script.js         - Frontend JavaScript
│   └── style.css         - Styling and layout
├── templates/
│   └── index.html        - Web interface HTML
└── uploads/              - Directory for uploaded photos (auto-created)


USAGE GUIDE
================================================================================

STEP 1: Start the Application
------------------------------
Run: bash setpup.sh
Or: python3 app.py (if already set up)

STEP 2: Access the Web Interface
--------------------------------
Open your browser and go to: http://localhost:5000

STEP 3: Upload or Select a Photo
--------------------------------
• Click "Select Photo" to upload a new image from your computer
• Or select a previously uploaded photo from the list

STEP 4: Edit Your Photo (Optional)
----------------------------------
• Click "Crop" to adjust the photo composition
• Click "Reset" to revert to the original image

STEP 5: Generate Passport Photos
--------------------------------
• Click "Generate" to create the 4×6 passport photo sheet
• Wait for processing (includes background removal and layout)

STEP 6: Preview & Download
---------------------------
• Review the generated passport photo sheet
• Click "Download" to save the file to your computer
• Print on standard 6×4 inch photo paper for best results


OUTPUT SPECIFICATIONS
================================================================================
• Sheet Size: 6 inches × 4 inches
• Resolution: 300 DPI (professional print quality)
• Format: Multiple passport photos arranged for efficient cutting
• Background: Pure white (#FFFFFF)
• Color Space: RGB


TROUBLESHOOTING
================================================================================

Issue: "Flask not installed" error
Solution: Run the setup script to install dependencies
  bash setpup.sh

Issue: "rembg not available" warning
Solution: This library requires significant disk space and processing power.
  Make sure you have:
  • At least 5GB free disk space
  • Good internet connection during installation
  • Sufficient RAM (8GB recommended)
  
  Reinstall with: pip3 install rembg

Issue: Application runs slow or freezes
Solution:
  • Close other applications to free up RAM
  • Ensure background removal is not processing large images
  • Try uploading smaller image files
  • Restart the application

Issue: Port 5000 already in use
Solution: The application uses port 5000. If this port is busy:
  • Modify the port in app.py (change app.run() parameters)
  • Or close other applications using this port

Issue: "Invalid image file" error
Solution:
  • Ensure the file is a valid image (JPEG, PNG, GIF, BMP)
  • Try re-saving the image in a different format
  • Ensure file size is reasonable (under 50MB)

Issue: Background removal not working
Solution:
  • This feature requires PyTorch and ONNX Runtime
  • First-time use downloads model files (~500MB)
  • Ensure stable internet connection
  • Check that you have sufficient disk space


PERFORMANCE NOTES
================================================================================
• First-time setup takes 10-15 minutes due to dependency downloads
• Background removal takes 5-30 seconds per image (depends on image size)
• Large images (>5MP) may take longer to process
• Consider using 2-4MP images for optimal speed


BROWSER COMPATIBILITY
================================================================================
✓ Chrome 90+
✓ Firefox 88+
✓ Safari 14+
✓ Edge 90+
✗ Internet Explorer (not supported)


TIPS FOR BEST RESULTS
================================================================================
1. Use well-lit photos with clear subject separation from background
2. Ensure your face fills at least 50% of the frame
3. Keep a neutral expression and look straight at the camera
4. Use photos with uniform, simple backgrounds
5. Print on high-quality glossy photo paper (6×4 inches)
6. Trim individual photos using the provided guides


SUPPORT & HELP
================================================================================
If you encounter issues or need help:

1. Check the TROUBLESHOOTING section above
2. Review the Flask and rembg documentation:
   - Flask: https://flask.palletsprojects.com/
   - rembg: https://github.com/danielgatis/rembg

3. Ensure all dependencies are correctly installed:
   pip3 freeze

4. Check application logs in the terminal for detailed error messages


VERSION HISTORY
================================================================================
Version 1.0 - Initial Release
- Passport photo generation on 4×6 sheets
- Automatic background removal
- Photo cropping and editing
- Web-based interface


NOTES
================================================================================
• Generated photos are saved in the uploads/ directory
• Always keep backups of original photos
• For commercial use, ensure compliance with local regulations
• The application is optimized for personal use and small batches
• For bulk processing, consider command-line alternatives or modifications


For more information or updates, check the project folder regularly.
Last Updated: February 2026.
