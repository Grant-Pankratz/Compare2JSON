# This is a sample Python script.

# Press ⌃R to execute it or replace it with your code.
# Press Double ⇧ to search everywhere for classes, files, tool windows, actions, and settings.

from flask import Flask, render_template, request, jsonify
import json
import difflib

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/compare', methods=['POST'])
def compare_json():
    if 'file1' not in request.files or 'file2' not in request.files:
        return jsonify({'error': 'Both files are required'}), 400
    
    file1 = request.files['file1']
    file2 = request.files['file2']
    
    try:
        json1 = json.loads(file1.read().decode('utf-8'))
        json2 = json.loads(file2.read().decode('utf-8'))
        
        # Convert JSON to formatted strings for comparison
        json1_str = json.dumps(json1, indent=2)
        json2_str = json.dumps(json2, indent=2)
        
        # Generate diff
        diff = list(difflib.unified_diff(
            json1_str.splitlines(),
            json2_str.splitlines(),
            fromfile='File 1',
            tofile='File 2',
            lineterm=''
        ))
        return jsonify({
            'diff': diff,
            'json1': json1,
            'json2': json2
        })
    except json.JSONDecodeError:
        return jsonify({'error': 'Invalid JSON file(s)'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=8080)

# See PyCharm help at https://www.jetbrains.com/help/pycharm/
