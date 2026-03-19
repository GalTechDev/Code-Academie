const PyLoader = {
    pyodide: null,
    output: [],

    init: async () => {
        const consoleEl = document.getElementById('output-console');
        try {
            consoleEl.innerHTML = '<span class="console-info">Initialisation de Python... (Cela peut prendre quelques secondes)</span>';

            PyLoader.pyodide = await loadPyodide();

            // Custom input implementation
            PyLoader.pyodide.setStdin({
                stdin: () => prompt("Python demande une entrée :")
            });

            // Redirect stdout
            PyLoader.pyodide.runPython(`
import sys
import io

class JSOutput:
    def write(self, text):
        import js
        js.PyLoader.handleOutput(text)
    def flush(self):
        pass

sys.stdout = JSOutput()
sys.stderr = JSOutput()
            `);

            consoleEl.innerHTML += '\n<span class="console-info">Python est prêt ! 🐍</span>';
            return true;
        } catch (err) {
            console.error(err);
            consoleEl.innerHTML = `<span class="console-error">Erreur de chargement Python : ${err.message}</span>`;
            return false;
        }
    },

    handleOutput: (text) => {
        const consoleEl = document.getElementById('output-console');
        // Simple sanitization
        const safeText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        consoleEl.innerHTML += safeText;
        consoleEl.scrollTop = consoleEl.scrollHeight;
        PyLoader.output.push(text);
    },

    run: async (code) => {
        const consoleEl = document.getElementById('output-console');
        consoleEl.innerHTML = ''; // Clear previous output
        PyLoader.output = [];

        try {
            await PyLoader.pyodide.loadPackagesFromImports(code);
            await PyLoader.pyodide.runPythonAsync(code);
            return { success: true, output: PyLoader.output.join('') };
        } catch (err) {
            consoleEl.innerHTML += `\n<span class="console-error">${err.message}</span>`;
            return { success: false, error: err.message };
        }
    },

    // Helper to check variables in memory
    getVariable: (varName) => {
        try {
            return PyLoader.pyodide.globals.get(varName);
        } catch (e) {
            return null;
        }
    },

    getGlobals: () => {
        try {
            const globals = PyLoader.pyodide.globals;
            const variables = {};
            // Iterator over keys
            const iterator = globals.toJs().keys();

            for (const key of iterator) {
                // Filter private vars and system modules
                if (!key.startsWith('_') &&
                    !['sys', 'io', 'JSOutput', 'open', 'quit', 'exit', 'copyright', 'credits', 'license', 'help'].includes(key)) {

                    let value = globals.get(key);
                    // Convert PyProxy to JS if possible
                    if (value && value.toJs) {
                        try { value = value.toJs(); } catch (e) { }
                    }
                    variables[key] = value;
                }
            }
            return variables;
        } catch (e) {
            console.error("Error global vars", e);
            return {};
        }
    }
};

window.PyLoader = PyLoader;
