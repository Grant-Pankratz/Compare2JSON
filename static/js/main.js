document.addEventListener('DOMContentLoaded', function() {
    // Compare button
    compareBtn.addEventListener('click', function() {
        compareJsonFiles();
    });

    // Functions
    function handleFileUpload(file, textareaElement, jsonIndex) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const content = e.target.result;
                const json = JSON.parse(content);
                const formattedJson = JSON.stringify(json, null, 2);
                textareaElement.value = formattedJson;
                updateJsonViews(formattedJson, jsonIndex);
                textareaElement.classList.remove('is-invalid');
                textareaElement.classList.add('is-valid');
                
                // Store the parsed JSON object
                if (jsonIndex === 1) {
                    json1Object = json;
                    updateJsonStats(json, 1);
                } else {
                    json2Object = json;
                    updateJsonStats(json, 2);
                }
            } catch (error) {
                textareaElement.value = 'Invalid JSON file';
                textareaElement.classList.add('is-invalid');
                resetJsonStats(jsonIndex);
                showToast('Error', 'The file does not contain valid JSON.', 'danger');
            }
        };
        reader.readAsText(file);
    }

    function updateJsonViews(jsonStr, jsonIndex) {
        const displayElement = jsonIndex === 1 ? json1Display : json2Display;
        const treeElement = jsonIndex === 1 ? jsonTree1 : jsonTree2;
        
        // Update text display
        displayElement.textContent = jsonStr;
        
        // Update tree display
        try {
            const jsonObj = JSON.parse(jsonStr);
            treeElement.innerHTML = generateJsonTree(jsonObj);
            
            // Add collapsible functionality to tree view
            const collapsibles = treeElement.querySelectorAll('.collapsible');
            collapsibles.forEach(item => {
                item.addEventListener('click', function() {
                    this.classList.toggle('active');
                    const content = this.nextElementSibling;
                    content.style.display = content.style.display === 'none' ? 'block' : 'none';
                });
            });
        } catch (error) {
            treeElement.innerHTML = '<div class="alert alert-danger">Invalid JSON</div>';
        }
    }

    function generateJsonTree(json, indent = 0) {
        if (json === null) return '<span class="null">null</span>';
        
        let html = '';
        const indentStr = '  '.repeat(indent);
        
        if (Array.isArray(json)) {
            if (json.length === 0) return '<span>[]</span>';
            
            html += '<span class="collapsible">[</span><div style="margin-left: 20px;">';
            json.forEach((item, index) => {
                html += `<div>${generateJsonTree(item, indent + 1)}${index < json.length - 1 ? ',' : ''}</div>`;
            });
            html += '</div><span>]</span>';
        } else if (typeof json === 'object') {
            const keys = Object.keys(json);
            if (keys.length === 0) return '<span>{}</span>';
            
            html += '<span class="collapsible">{</span><div style="margin-left: 20px;">';
            keys.forEach((key, index) => {
                html += `<div><span class="key">"${key}"</span>: ${generateJsonTree(json[key], indent + 1)}${index < keys.length - 1 ? ',' : ''}</div>`;
            });
            html += '</div><span>}</span>';
        } else if (typeof json === 'string') {
            html += `<span class="string">"${escapeHtml(json)}"</span>`;
        } else if (typeof json === 'number') {
            html += `<span class="number">${json}</span>`;
        } else if (typeof json === 'boolean') {
            html += `<span class="boolean">${json}</span>`;
        }
        
        return html;
    }

    function escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function compareJsonFiles() {
        if (!validateInputs()) return;
        
        // Get JSON data
        const json1 = json1Object;
        const json2 = json2Object;
        
        // Show loading spinner
        diffResult.innerHTML = '<div class="spinner-container"><div class="spinner-border" role="status"></div></div>';
        diffTreeView.innerHTML = diffResult.innerHTML;
        diffLeft.innerHTML = diffResult.innerHTML;
        diffRight.innerHTML = diffResult.innerHTML;
        
        // Send request to server
        const formData = new FormData();
        formData.append('file1', new Blob([JSON.stringify(json1)], {type: 'application/json'}));
        formData.append('file2', new Blob([JSON.stringify(json2)], {type: 'application/json'}));
        
        fetch('/compare', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showComparisonError(data.error);
                return;
            }
            
            // Store the comparison result
            lastComparisonResult = data;
            
            // Update diff views based on current mode
            updateDiffViews(data);
            
            // Show the export button
            exportBtn.disabled = false;
            
            // Scroll to the diff result
            document.querySelector('.diff-card').scrollIntoView({ behavior: 'smooth' });
        })
        .catch(error => {
            showComparisonError(`Error: ${error.message}`);
        });
    }

    function updateDiffViews(data) {
        // Update unified diff view
        let diffHtml = '';
        
        if (data.diff.length === 0) {
            diffHtml = '<div class="alert alert-success">No differences found! The JSON files are identical.</div>';
        } else {
            data.diff.forEach(line => {
                if (line.startsWith('+')) {
                    diffHtml += `<div class="diff-add">${escapeHtml(line)}</div>`;
                } else if (line.startsWith('-')) {
                    diffHtml += `<div class="diff-remove">${escapeHtml(line)}</div>`;
                } else {
                    diffHtml += `<div>${escapeHtml(line)}</div>`;
                }
            });
        }
        
        diffResult.innerHTML = diffHtml;
        
        // Update tree diff view
        updateTreeDiffView(data.json1, data.json2);
        
        // Update split diff view
        updateSplitDiffView(data.json1, data.json2);
        
        // Show the current diff view
        setDiffViewMode(currentDiffView);
    }

    function updateTreeDiffView(json1, json2) {
        const diffTreeObj = generateDiffTree(json1, json2);
        diffTreeView.innerHTML = renderDiffTree(diffTreeObj);
        
        // Add collapsible functionality to tree view
        const collapsibles = diffTreeView.querySelectorAll('.collapsible');
        collapsibles.forEach(item => {
            item.addEventListener('click', function() {
                this.classList.toggle('active');
                const content = this.nextElementSibling;
                content.style.display = content.style.display === 'none' ? 'block' : 'none';
            });
        });
    }

    function generateDiffTree(obj1, obj2, path = '') {
        const result = { status: 'unchanged', children: {} };
        
        // Get all keys from both objects
        const keys = new Set([
            ...Object.keys(obj1 || {}),
            ...Object.keys(obj2 || {})
        ]);
        
        for (const key of keys) {
            const val1 = obj1 ? obj1[key] : undefined;
            const val2 = obj2 ? obj2[key] : undefined;
            const childPath = path ? `${path}.${key}` : key;
            
            // Key exists only in obj1
            if (obj2 === undefined || !(key in obj2)) {
                result.children[key] = { status: 'removed', value: val1 };
                continue;
            }
            
            // Key exists only in obj2
            if (obj1 === undefined || !(key in obj1)) {
                result.children[key] = { status: 'added', value: val2 };
                continue;
            }
            
            // Both have the key, but with different types
            if (typeof val1 !== typeof val2) {
                result.children[key] = { 
                    status: 'changed', 
                    oldValue: val1,
                    newValue: val2
                };
                continue;
            }
            
            // Both are objects (or arrays) - recursive comparison
            if (typeof val1 === 'object' && val1 !== null && val2 !== null) {
                result.children[key] = generateDiffTree(val1, val2, childPath);
                // If all children are unchanged, mark this node as unchanged
                if (result.children[key].status === 'unchanged' && 
                    Object.values(result.children[key].children).every(child => child.status === 'unchanged')) {
                    result.children[key] = { status: 'unchanged', value: val1 };
                }
                continue;
            }
            
            // Primitive values - simple comparison
            if (val1 === val2) {
                result.children[key] = { status: 'unchanged', value: val1 };
            } else {
                result.children[key] = { 
                    status: 'changed', 
                    oldValue: val1,
                    newValue: val2
                };
            }
        }
        
        // Check if any children have changed
        const hasChanges = Object.values(result.children).some(child => child.status !== 'unchanged');
        if (hasChanges) {
            result.status = 'changed';
        }
        
        return result;
    }

    function renderDiffTree(diffTree, indent = 0) {
        let html = '';
        const indentStr = '  '.repeat(indent);
        
        if (!diffTree.children) {
            // Leaf node
            return renderDiffValue(diffTree);
        }
        
        html += '<ul class="list-unstyled" style="margin-left: 20px;">';
        
        for (const [key, node] of Object.entries(diffTree.children)) {
            html += '<li>';
            
            if (node.status === 'unchanged') {
                html += `<span class="key">"${key}"</span>: ${renderDiffValue(node)}`;
            } else if (node.status === 'added') {
                html += `<span class="key added">"${key}"</span>: ${renderDiffValue(node)}`;
            } else if (node.status === 'removed') {
                html += `<span class="key removed">"${key}"</span>: ${renderDiffValue(node)}`;
            } else if (node.status === 'changed') {
                if (node.children) {
                    html += `<span class="key changed">"${key}"</span>: ${renderDiffTree(node, indent + 1)}`;
                } else {
                    html += `<span class="key changed">"${key}"</span>: `;
                    html += `<span class="removed">${renderValue(node.oldValue)}</span> → `;
                    html += `<span class="added">${renderValue(node.newValue)}</span>`;
                }
            }
            
            html += '</li>';
        }
        
        html += '</ul>';
        return html;
    }

    function renderDiffValue(node) {
        if (node.children) {
            return renderDiffTree(node);
        }
        
        if (node.status === 'changed') {
            return `<span class="removed">${renderValue(node.oldValue)}</span> → <span class="added">${renderValue(node.newValue)}</span>`;
        }
        
        return renderValue(node.value);
    }

    function renderValue(value) {
        if (value === null) return '<span class="null">null</span>';
        if (typeof value === 'string') return `<span class="string">"${escapeHtml(value)}"</span>`;
        if (typeof value === 'number') return `<span class="number">${value}</span>`;
        if (typeof value === 'boolean') return `<span class="boolean">${value}</span>`;
        
        if (typeof value === 'object') {
            if (Array.isArray(value)) {
                if (value.length === 0) return '[]';
                return '<span class="collapsible">[...]</span><div style="display: none;">Array with ' + value.length + ' items</div>';
            } else {
                const keys = Object.keys(value);
                if (keys.length === 0) return '{}';
                return '<span class="collapsible">{...}</span><div style="display: none;">Object with ' + keys.length + ' properties</div>';
            }
        }
        
        return String(value);
    }

    function updateSplitDiffView(json1, json2) {
        diffLeft.innerHTML = '<pre>' + JSON.stringify(json1, null, 2) + '</pre>';
        diffRight.innerHTML = '<pre>' + JSON.stringify(json2, null, 2) + '</pre>';
    }

    function setDiffViewMode(mode) {
        currentDiffView = mode;
        
        // Update active button
        diffViewUnified.classList.remove('active');
        diffViewSplit.classList.remove('active');
        diffViewTree.classList.remove('active');
        
        // Hide all views
        diffResult.classList.add('d-none');
        diffTreeView.classList.add('d-none');
        diffSplitView.classList.add('d-none');
        
        // Show selected view
        if (mode === 'unified') {
            diffViewUnified.classList.add('active');
            diffResult.classList.remove('d-none');
        } else if (mode === 'split') {
            diffViewSplit.classList.add('active');
            diffSplitView.classList.remove('d-none');
        } else if (mode === 'tree') {
            diffViewTree.classList.add('active');
            diffTreeView.classList.remove('d-none');
        }
    }

    function validateInputs() {
        let valid = true;
        
        // Check if JSON 1 is valid
        try {
            if (!json1Object) {
                const content = jsonTextarea1.value.trim();
                if (content) {
                    json1Object = JSON.parse(content);
                } else {
                    throw new Error('JSON 1 is empty');
                }
            }
        } catch (error) {
            jsonTextarea1.classList.add('is-invalid');
            showToast('Error', 'Invalid JSON in the first input.', 'danger');
            valid = false;
        }
        
        // Check if JSON 2 is valid
        try {
            if (!json2Object) {
                const content = jsonTextarea2.value.trim();
                if (content) {
                    json2Object = JSON.parse(content);
                } else {
                    throw new Error('JSON 2 is empty');
                }
            }
        } catch (error) {
            jsonTextarea2.classList.add('is-invalid');
            showToast('Error', 'Invalid JSON in the second input.', 'danger');
            valid = false;
        }
        
        return valid;
    }

    function openPasteModal(targetIndex) {
        currentPasteTarget = targetIndex;
        pasteModalTextarea.value = '';
        const pasteModal = new bootstrap.Modal(document.getElementById('pasteModal'));
        pasteModal.show();
    }

    function submitPasteModal() {
        const jsonStr = pasteModalTextarea.value;
        
        try {
            // Try to parse and format the JSON
            const jsonObj = JSON.parse(jsonStr);
            const formattedJson = JSON.stringify(jsonObj, null, 2);
            
            if (currentPasteTarget === 1) {
                jsonTextarea1.value = formattedJson;
                json1Object = jsonObj;
                updateJsonViews(formattedJson, 1);
                jsonTextarea1.classList.remove('is-invalid');
                jsonTextarea1.classList.add('is-valid');
                updateJsonStats(jsonObj, 1);
            } else {
                jsonTextarea2.value = formattedJson;
                json2Object = jsonObj;
                updateJsonViews(formattedJson, 2);
                jsonTextarea2.classList.remove('is-invalid');
                jsonTextarea2.classList.add('is-valid');
                updateJsonStats(jsonObj, 2);
            }
            
            // Close the modal
            bootstrap.Modal.getInstance(document.getElementById('pasteModal')).hide();
            
        } catch (error) {
            showToast('Error', 'Invalid JSON content. Please check and try again.', 'danger');
        }
    }

    function clearJson(index) {
        if (index === 1) {
            jsonTextarea1.value = '';
            json1Display.textContent = '';
            jsonTree1.innerHTML = '';
            json1Object = null;
            jsonTextarea1.classList.remove('is-valid', 'is-invalid');
            resetJsonStats(1);
        } else {
            jsonTextarea2.value = '';
            json2Display.textContent = '';
            jsonTree2.innerHTML = '';
            json2Object = null;
            jsonTextarea2.classList.remove('is-valid', 'is-invalid');
            resetJsonStats(2);
        }
    }

    function formatJsonContent() {
        // Format JSON 1
        if (jsonTextarea1.value.trim() !== '') {
            try {
                const jsonObj = JSON.parse(jsonTextarea1.value);
                jsonTextarea1.value = JSON.stringify(jsonObj, null, 2);
                jsonTextarea1.classList.remove('is-invalid');
                jsonTextarea1.classList.add('is-valid');
                updateJsonViews(jsonTextarea1.value, 1);
                json1Object = jsonObj;
                updateJsonStats(jsonObj, 1);
                showToast('Success', 'JSON 1 formatted successfully.', 'success');
            } catch (error) {
                jsonTextarea1.classList.add('is-invalid');
                showToast('Error', 'Invalid JSON in the first input.', 'danger');
            }
        }
        
        // Format JSON 2
        if (jsonTextarea2.value.trim() !== '') {
            try {
                const jsonObj = JSON.parse(jsonTextarea2.value);
                jsonTextarea2.value = JSON.stringify(jsonObj, null, 2);
                jsonTextarea2.classList.remove('is-invalid');
                jsonTextarea2.classList.add('is-valid');
                updateJsonViews(jsonTextarea2.value, 2);
                json2Object = jsonObj;
                updateJsonStats(jsonObj, 2);
                showToast('Success', 'JSON 2 formatted successfully.', 'success');
            } catch (error) {
                jsonTextarea2.classList.add('is-invalid');
                showToast('Error', 'Invalid JSON in the second input.', 'danger');
            }
        }
    }

    function validateJsonContent() {
        let valid = true;
        
        // Validate JSON 1
        if (jsonTextarea1.value.trim() !== '') {
            try {
                const jsonObj = JSON.parse(jsonTextarea1.value);
                jsonTextarea1.classList.remove('is-invalid');
                jsonTextarea1.classList.add('is-valid');
                json1Object = jsonObj;
                updateJsonStats(jsonObj, 1);
            } catch (error) {
                jsonTextarea1.classList.remove('is-valid');
                jsonTextarea1.classList.add('is-invalid');
                valid = false;
            }
        }
        
        // Validate JSON 2
        if (jsonTextarea2.value.trim() !== '') {
            try {
                const jsonObj = JSON.parse(jsonTextarea2.value);
                jsonTextarea2.classList.remove('is-invalid');
                jsonTextarea2.classList.add('is-valid');
                json2Object = jsonObj;
                updateJsonStats(jsonObj, 2);
            } catch (error) {
                jsonTextarea2.classList.remove('is-valid');
                jsonTextarea2.classList.add('is-invalid');
                valid = false;
            }
        }
        
        if (valid) {
            showToast('Success', 'All JSON content is valid.', 'success');
        } else {
            showToast('Error', 'Invalid JSON detected. Check for syntax errors.', 'danger');
        }
    }

    function toggleViewMode() {
        if (currentViewMode === 'text') {
            // Switch to tree view
            currentViewMode = 'tree';
            viewModeBtn.innerHTML = '<i class="fas fa-code"></i> Text View';
            
            // Update JSON displays
            json1Display.classList.add('d-none');
            json2Display.classList.add('d-none');
            jsonTree1.classList.remove('d-none');
            jsonTree2.classList.remove('d-none');
            
            // Update both JSON trees
            if (json1Object) {
                updateJsonViews(JSON.stringify(json1Object, null, 2), 1);
            }
            if (json2Object) {
                updateJsonViews(JSON.stringify(json2Object, null, 2), 2);
            }
        } else {
            // Switch to text view
            currentViewMode = 'text';
            viewModeBtn.innerHTML = '<i class="fas fa-list"></i> Tree View';
            
            // Update JSON displays
            json1Display.classList.remove('d-none');
            json2Display.classList.remove('d-none');
            jsonTree1.classList.add('d-none');
            jsonTree2.classList.add('d-none');
        }
    }

    function exportDiff() {
        if (!lastComparisonResult) {
            showToast('Error', 'No comparison results to export.', 'danger');
            return;
        }
        
        // Format the export content based on current view
        let exportContent = '';
        const dateStr = new Date().toISOString().slice(0, 10);
        const filename = `json-diff-${dateStr}.txt`;
        
        if (currentDiffView === 'unified') {
            exportContent = lastComparisonResult.diff.join('\n');
        } else if (currentDiffView === 'split') {
            exportContent = '--- JSON 1 ---\n\n';
            exportContent += JSON.stringify(lastComparisonResult.json1, null, 2);
            exportContent += '\n\n--- JSON 2 ---\n\n';
            exportContent += JSON.stringify(lastComparisonResult.json2, null, 2);
        } else {
            // For tree view, export a summary
            exportContent = 'JSON Diff Summary\n\n';
            exportContent += `Date: ${new Date().toLocaleString()}\n\n`;
            exportContent += `JSON 1 Size: ${JSON.stringify(lastComparisonResult.json1).length} characters\n`;
            exportContent += `JSON 2 Size: ${JSON.stringify(lastComparisonResult.json2).length} characters\n\n`;
            exportContent += '--- Unified Diff ---\n\n';
            exportContent += lastComparisonResult.diff.join('\n');
        }
        
        // Create and download the file
        const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, filename);
        
        showToast('Success', 'Diff exported successfully.', 'success');
    }

    function showComparisonError(message) {
        diffResult.innerHTML = `<div class="alert alert-danger">${message}</div>`;
        diffTreeView.innerHTML = diffResult.innerHTML;
        diffLeft.innerHTML = '';
        diffRight.innerHTML = '';
        exportBtn.disabled = true;
    }

    function updateJsonStats(json, index) {
        const stats = calculateJsonStats(json);
        
        if (index === 1) {
            json1Size.textContent = stats.size;
            json1Props.textContent = stats.properties;
            json1Depth.textContent = stats.depth;
        } else {
            json2Size.textContent = stats.size;
            json2Props.textContent = stats.properties;
            json2Depth.textContent = stats.depth;
        }
    }

    function resetJsonStats(index) {
        if (index === 1) {
            json1Size.textContent = '-';
            json1Props.textContent = '-';
            json1Depth.textContent = '-';
        } else {
            json2Size.textContent = '-';
            json2Props.textContent = '-';
            json2Depth.textContent = '-';
        }
    }

    function calculateJsonStats(json) {
        const stats = {
            size: JSON.stringify(json).length + ' bytes',
            properties: 0,
            depth: 0
        };
        
        // Calculate properties count and max depth
        function traverse(obj, depth = 1) {
            stats.depth = Math.max(stats.depth, depth);
            
            if (typeof obj !== 'object' || obj === null) {
                return;
            }
            
            if (Array.isArray(obj)) {
                obj.forEach(item => traverse(item, depth + 1));
            } else {
                stats.properties += Object.keys(obj).length;
                Object.values(obj).forEach(val => traverse(val, depth + 1));
            }
        }
        
        traverse(json);
        return stats;
    }

    function showToast(title, message, type) {
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }
        
        // Create toast element
        const toastId = 'toast-' + Date.now();
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type}`;
        toast.id = toastId;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <strong>${title}</strong>: ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        `;
        
        toastContainer.appendChild(toast);
        
        // Show the toast
        const bsToast = new bootstrap.Toast(toast, {
            autohide: true,
            delay: 3000
        });
        bsToast.show();
        
        // Remove toast after it's hidden
        toast.addEventListener('hidden.bs.toast', function () {
            toast.remove();
        });
    }

    function initTheme() {
        // Check for saved theme preference or use default
        const savedTheme = localStorage.getItem('jsonify-theme') || 'light';
        setTheme(savedTheme);
    }

    function setTheme(theme) {
        // Save theme preference
        localStorage.setItem('jsonify-theme', theme);
        
        // Apply theme to document
        document.documentElement.setAttribute('data-theme', theme);
    } Elements
    const file1Input = document.getElementById('file1');
    const file2Input = document.getElementById('file2');
    const jsonTextarea1 = document.getElementById('jsonTextarea1');
    const jsonTextarea2 = document.getElementById('jsonTextarea2');
    const json1Display = document.getElementById('json1');
    const json2Display = document.getElementById('json2');
    const compareBtn = document.getElementById('compareBtn');
    const viewModeBtn = document.getElementById('viewModeBtn');
    const exportBtn = document.getElementById('exportBtn');
    const diffResult = document.getElementById('diffResult');
    const diffTreeView = document.getElementById('diffTreeView');
    const diffSplitView = document.getElementById('diffSplitView');
    const diffLeft = document.getElementById('diffLeft');
    const diffRight = document.getElementById('diffRight');
    const helpBtn = document.getElementById('helpBtn');
    const formatBtn = document.getElementById('formatBtn');
    const validateBtn = document.getElementById('validateBtn');
    const jsonTree1 = document.getElementById('jsonTree1');
    const jsonTree2 = document.getElementById('jsonTree2');
    const pasteBtn1 = document.getElementById('pasteBtn1');
    const pasteBtn2 = document.getElementById('pasteBtn2');
    const clearBtn1 = document.getElementById('clearBtn1');
    const clearBtn2 = document.getElementById('clearBtn2');
    const pasteModalTextarea = document.getElementById('pasteModalTextarea');
    const pasteModalSubmit = document.getElementById('pasteModalSubmit');
    const diffViewUnified = document.getElementById('diffViewUnified');
    const diffViewSplit = document.getElementById('diffViewSplit');
    const diffViewTree = document.getElementById('diffViewTree');
    
    // Stats elements
    const json1Size = document.getElementById('json1Size');
    const json1Props = document.getElementById('json1Props');
    const json1Depth = document.getElementById('json1Depth');
    const json2Size = document.getElementById('json2Size');
    const json2Props = document.getElementById('json2Props');
    const json2Depth = document.getElementById('json2Depth');

    // State variables
    let currentPasteTarget = null;
    let json1Object = null;
    let json2Object = null;
    let currentViewMode = 'text';
    let currentDiffView = 'unified';
    let lastComparisonResult = null;

    // Initialize Bootstrap tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Initialize theme
    initTheme();

    // Set up event listeners for file inputs
    file1Input.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0], jsonTextarea1, 1);
        }
    });

    file2Input.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0], jsonTextarea2, 2);
        }
    });

    // Text area input event for real-time JSON validation
    jsonTextarea1.addEventListener('input', function() {
        try {
            const json = JSON.parse(this.value);
            json1Object = json;
            this.classList.remove('is-invalid');
            this.classList.add('is-valid');
            updateJsonStats(json, 1);
        } catch (e) {
            this.classList.remove('is-valid');
            if (this.value.trim() !== '') {
                this.classList.add('is-invalid');
            } else {
                this.classList.remove('is-invalid');
            }
            resetJsonStats(1);
        }
    });

    jsonTextarea2.addEventListener('input', function() {
        try {
            const json = JSON.parse(this.value);
            json2Object = json;
            this.classList.remove('is-invalid');
            this.classList.add('is-valid');
            updateJsonStats(json, 2);
        } catch (e) {
            this.classList.remove('is-valid');
            if (this.value.trim() !== '') {
                this.classList.add('is-invalid');
            } else {
                this.classList.remove('is-invalid');
            }
            resetJsonStats(2);
        }
    });

    // Help modal
    helpBtn.addEventListener('click', function() {
        const helpModal = new bootstrap.Modal(document.getElementById('helpModal'));
        helpModal.show();
    });

    // Format JSON button
    formatBtn.addEventListener('click', function() {
        formatJsonContent();
    });

    // Validate JSON button
    validateBtn.addEventListener('click', function() {
        validateJsonContent();
    });

    // Toggle view mode button
    viewModeBtn.addEventListener('click', function() {
        toggleViewMode();
    });

    // Export diff button
    exportBtn.addEventListener('click', function() {
        exportDiff();
    });

    // Paste buttons
    pasteBtn1.addEventListener('click', function() {
        openPasteModal(1);
    });

    pasteBtn2.addEventListener('click', function() {
        openPasteModal(2);
    });

    // Clear buttons
    clearBtn1.addEventListener('click', function() {
        clearJson(1);
    });

    clearBtn2.addEventListener('click', function() {
        clearJson(2);
    });

    // Paste modal submit button
    pasteModalSubmit.addEventListener('click', function() {
        submitPasteModal();
    });

    // Diff view mode buttons
    diffViewUnified.addEventListener('click', function() {
        setDiffViewMode('unified');
    });

    diffViewSplit.addEventListener('click', function() {
        setDiffViewMode('split');
    });

    diffViewTree.addEventListener('click', function() {
        setDiffViewMode('tree');
    });

    // Theme switcher
    document.querySelectorAll('[data-theme]').forEach(item => {
        item.addEventListener('click', event => {
            const theme = event.currentTarget.getAttribute('data-theme');
            setTheme(theme);
        });
    });

    //