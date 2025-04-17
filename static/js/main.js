document.addEventListener('DOMContentLoaded', function() {
    const file1Input = document.getElementById('file1');
    const file2Input = document.getElementById('file2');
    const compareBtn = document.getElementById('compareBtn');
    const json1Display = document.getElementById('json1');
    const json2Display = document.getElementById('json2');
    const diffResult = document.getElementById('diffResult');

    function displayJSON(file, displayElement) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const json = JSON.parse(e.target.result);
                displayElement.textContent = JSON.stringify(json, null, 2);
            } catch (error) {
                displayElement.textContent = 'Invalid JSON file';
            }
        };
        reader.readAsText(file);
    }

    file1Input.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            displayJSON(e.target.files[0], json1Display);
        }
    });

    file2Input.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            displayJSON(e.target.files[0], json2Display);
        }
    });

    compareBtn.addEventListener('click', function() {
        if (!file1Input.files.length || !file2Input.files.length) {
            alert('Please select both files to compare');
            return;
        }

        const formData = new FormData();
        formData.append('file1', file1Input.files[0]);
        formData.append('file2', file2Input.files[0]);

        fetch('/compare', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                diffResult.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
                return;
            }

            let diffHtml = '';
            data.diff.forEach(line => {
                if (line.startsWith('+')) {
                    diffHtml += `<div class="diff-add">${line}</div>`;
                } else if (line.startsWith('-')) {
                    diffHtml += `<div class="diff-remove">${line}</div>`;
                } else {
                    diffHtml += `<div>${line}</div>`;
                }
            });

            diffResult.innerHTML = diffHtml || '<div class="alert alert-success">No differences found!</div>';
        })
        .catch(error => {
            diffResult.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
        });
    });
}); 