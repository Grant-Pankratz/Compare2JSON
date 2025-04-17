from flask import Flask, render_template, request, jsonify, send_from_directory
import json
import difflib
import os
import re
from datetime import datetime

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

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
        
        # Generate semantic diff
        semantic_diff = generate_semantic_diff(json1, json2)
        
        return jsonify({
            'diff': diff,
            'json1': json1,
            'json2': json2,
            'semantic_diff': semantic_diff
        })
    except json.JSONDecodeError:
        return jsonify({'error': 'Invalid JSON file(s)'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/validate', methods=['POST'])
def validate_json():
    if 'json' not in request.form:
        return jsonify({'error': 'No JSON data provided'}), 400
    
    try:
        json_data = json.loads(request.form['json'])
        return jsonify({'valid': True, 'formatted': json.dumps(json_data, indent=2)})
    except json.JSONDecodeError as e:
        # Get details about the error
        error_msg = str(e)
        line_col_match = re.search(r'line (\d+) column (\d+)', error_msg)
        
        if line_col_match:
            line = int(line_col_match.group(1))
            column = int(line_col_match.group(2))
            
            # Get the content around the error
            json_lines = request.form['json'].split('\n')
            context_lines = []
            
            start = max(0, line - 3)
            end = min(len(json_lines), line + 2)
            
            for i in range(start, end):
                prefix = '→ ' if i + 1 == line else '  '
                context_lines.append(f"{prefix}{i+1}: {json_lines[i]}")
            
            return jsonify({
                'valid': False,
                'error': {
                    'message': error_msg,
                    'line': line,
                    'column': column,
                    'context': '\n'.join(context_lines)
                }
            })
        else:
            return jsonify({'valid': False, 'error': {'message': error_msg}})
    except Exception as e:
        return jsonify({'valid': False, 'error': {'message': str(e)}})

@app.route('/format', methods=['POST'])
def format_json():
    if 'json' not in request.form:
        return jsonify({'error': 'No JSON data provided'}), 400
    
    try:
        json_data = json.loads(request.form['json'])
        return jsonify({
            'success': True,
            'formatted': json.dumps(json_data, indent=2)
        })
    except json.JSONDecodeError as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/export', methods=['POST'])
def export_diff():
    if 'content' not in request.form:
        return jsonify({'error': 'No content provided'}), 400
    
    content = request.form['content']
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    filename = f"json_diff_{timestamp}.txt"
    
    # Create an export directory if it doesn't exist
    export_dir = os.path.join(app.static_folder, 'exports')
    os.makedirs(export_dir, exist_ok=True)
    
    file_path = os.path.join(export_dir, filename)
    
    with open(file_path, 'w') as f:
        f.write(content)
    
    return jsonify({
        'success': True,
        'download_url': f"/static/exports/{filename}"
    })

def generate_semantic_diff(json1, json2, path=""):
    """Generate a semantic diff between two JSON objects."""
    diff = []
    
    # Handle different types
    if type(json1) != type(json2):
        diff.append({
            'path': path,
            'type': 'type_change',
            'old': type(json1).__name__,
            'new': type(json2).__name__,
            'old_value': json1,
            'new_value': json2
        })
        return diff
    
    # Handle primitives (strings, numbers, booleans, None)
    if not isinstance(json1, (dict, list)) or json1 is None:
        if json1 != json2:
            diff.append({
                'path': path,
                'type': 'value_change',
                'old_value': json1,
                'new_value': json2
            })
        return diff
    
    # Handle lists
    if isinstance(json1, list):
        # Find the longest common subsequence
        matcher = difflib.SequenceMatcher(None, json1, json2)
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'replace':
                # Items were replaced
                for i, j in zip(range(i1, i2), range(j1, j2)):
                    item_path = f"{path}[{i}]"
                    diff.extend(generate_semantic_diff(json1[i], json2[j], item_path))
            elif tag == 'delete':
                # Items were deleted
                for i in range(i1, i2):
                    diff.append({
                        'path': f"{path}[{i}]",
                        'type': 'array_item_removed',
                        'value': json1[i]
                    })
            elif tag == 'insert':
                # Items were added
                for j in range(j1, j2):
                    diff.append({
                        'path': f"{path}[{j}]",
                        'type': 'array_item_added',
                        'value': json2[j]
                    })
        return diff
    
    # Handle dictionaries
    if isinstance(json1, dict):
        # Find keys in dict1 that are not in dict2
        for key in json1:
            if key not in json2:
                diff.append({
                    'path': f"{path}.{key}" if path else key,
                    'type': 'property_removed',
                    'value': json1[key]
                })
        
        # Find keys in dict2 that are not in dict1
        for key in json2:
            if key not in json1:
                diff.append({
                    'path': f"{path}.{key}" if path else key,
                    'type': 'property_added',
                    'value': json2[key]
                })
        
        # Compare values for keys in both dictionaries
        for key in json1:
            if key in json2:
                key_path = f"{path}.{key}" if path else key
                diff.extend(generate_semantic_diff(json1[key], json2[key], key_path))
        
        return diff
    
    return diff

if __name__ == '__main__':
    # Ensure static folder exists
    os.makedirs(os.path.join(app.root_path, 'static', 'css'), exist_ok=True)
    os.makedirs(os.path.join(app.root_path, 'static', 'js'), exist_ok=True)
    
    app.run(debug=True, port=8080)
