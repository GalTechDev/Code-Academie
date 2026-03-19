const App = {
    lessons: [],
    currentLesson: null,
    hintTimer: null,

    init: async () => {
        try {
            await PyLoader.init();

            const response = await fetch('data/content.json');
            const data = await response.json();
            App.lessons = data.lessons;

            App.renderNavigation();
            App.bindEvents();
            App.loadProgress();

            // Load first lesson
            App.loadLesson(App.lessons[0].id);

            // Hide loading overlay
            document.getElementById('loading-overlay').classList.add('hidden');

        } catch (err) {
            console.error("Init Error", err);
            document.getElementById('loading-overlay').innerHTML = '<div class="loading-content"><p style="color:#ef4444;">Erreur de chargement</p></div>';
        }
    },

    bindEvents: () => {
        document.getElementById('run-btn').addEventListener('click', App.runUserCode);
        document.getElementById('code-editor').addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                App.runUserCode();
            }
        });

        // Tab Switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                document.getElementById(`tab-${tabName}`).classList.add('active');
            });
        });
    },

    runUserCode: async () => {
        const code = document.getElementById('code-editor').value;
        const result = await PyLoader.run(code);

        App.validateExercise(code, result);

        // Update Variables
        if (PyLoader.getGlobals) {
            App.renderVariables(PyLoader.getGlobals());
        }
    },

    renderVariables: (vars) => {
        const container = document.getElementById('variables-grid');
        container.innerHTML = '';

        const keys = Object.keys(vars);
        if (keys.length === 0) {
            container.innerHTML = '<div class="empty-state">Aucune variable définie.</div>';
            return;
        }

        keys.forEach(key => {
            let value = vars[key];
            let type = typeof value;
            if (Array.isArray(value)) type = 'list';
            if (value === null) type = 'None';
            if (typeof value === 'object') value = JSON.stringify(value);

            const card = document.createElement('div');
            card.className = 'schema-table';
            card.innerHTML = `
                <div class="schema-table-name" style="color: var(--accent); border-color: rgba(255,212,59,0.2);">
                    <span>📦 ${key}</span>
                </div>
                <ul class="schema-columns">
                    <li><span style="color: #64748b;">Type:</span> <span style="color: var(--primary);">${type}</span></li>
                    <li><span style="color: #64748b;">Valeur:</span> <span style="color: #e2e8f0;">${value}</span></li>
                </ul>
            `;
            container.appendChild(card);
        });
    },

    validateExercise: (userCode, executionResult) => {
        if (!App.currentLesson || !App.currentLesson.exercise) return;

        const exercise = App.currentLesson.exercise;
        const feedback = document.getElementById('feedback-msg');

        // Simple Validation: Check Expected Output or Code Patterns
        // Can be improved with more complex logic later

        let success = false;

        if (executionResult.success) {
            const cleanOutput = executionResult.output.trim();

            if (exercise.validation.type === 'output_match') {
                if (cleanOutput === exercise.validation.expectedOutput) {
                    success = true;
                }
            } else if (exercise.validation.type === 'variable_check') {
                const val = PyLoader.getVariable(exercise.validation.varName);
                if (val === exercise.validation.expectedValue) {
                    success = true;
                }
            }
        }

        if (success) {
            feedback.textContent = "🎉 Bravo ! Exercice réussi.";
            feedback.className = 'feedback success';
            feedback.classList.remove('hidden');
            Storage.markComplete(exercise.id);
            App.renderNavigation();
        } else {
            feedback.textContent = executionResult.success
                ? "Le résultat n'est pas celui attendu. Vérifiez la consigne."
                : "Erreur dans le code.";
            feedback.className = 'feedback error';
            feedback.classList.remove('hidden');
        }
    },

    loadLesson: (lessonId) => {
        const lesson = App.lessons.find(l => l.id === lessonId);
        if (!lesson) return;
        App.currentLesson = lesson;

        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.id === lessonId);
        });

        document.getElementById('lesson-title').textContent = lesson.title;
        const instructionEl = document.getElementById('lesson-instruction');
        if (instructionEl) instructionEl.textContent = lesson.exercise.instruction;

        App.setupHint(lesson);

        document.getElementById('theory-content').innerHTML = marked.parse(lesson.content);

        const editor = document.getElementById('code-editor');
        editor.value = lesson.exercise.placeholder || '';
        document.getElementById('feedback-msg').className = 'feedback hidden';
        document.getElementById('output-console').innerHTML = '';
    },

    setupHint: (lesson) => {
        const btn = document.getElementById('hint-btn');
        const btnText = document.getElementById('hint-btn-text');
        const hintContentEl = document.getElementById('hint-content');
        const hintBox = document.getElementById('lesson-hint');

        if (App.hintTimer) clearInterval(App.hintTimer);
        hintBox.classList.add('hidden');

        if (!lesson.exercise || !lesson.exercise.hint) {
            btn.style.display = 'none';
            return;
        }

        btn.style.display = 'flex';
        btn.classList.remove('unlocked');
        btn.classList.add('locked');
        btn.disabled = true;

        let timeLeft = 10;
        btnText.textContent = `Indice (${timeLeft}s)`;

        App.hintTimer = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                clearInterval(App.hintTimer);
                btn.classList.remove('locked');
                btn.classList.add('unlocked');
                btn.disabled = false;
                btnText.textContent = "Révéler l'indice";
            } else {
                btnText.textContent = `Indice (${timeLeft}s)`;
            }
        }, 1000);

        btn.onclick = () => {
            if (!btn.disabled) {
                hintContentEl.textContent = lesson.exercise.hint;
                hintBox.classList.remove('hidden');
                btn.style.display = 'none';
            }
        };
    },

    renderNavigation: () => {
        const navList = document.getElementById('lesson-list');
        navList.innerHTML = '';

        // Re-use logic from SQL Master, grouped by category
        let lastCategory = '';
        App.lessons.forEach(lesson => {
            if (lesson.category !== lastCategory) {
                const li = document.createElement('li');
                li.className = 'nav-header';
                li.textContent = lesson.category;
                navList.appendChild(li);
                lastCategory = lesson.category;
            }
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.className = 'nav-btn';
            btn.dataset.id = lesson.id;
            btn.textContent = lesson.title;
            btn.onclick = () => App.loadLesson(lesson.id);
            if (Storage.isComplete(lesson.exercise.id)) btn.classList.add('completed');
            li.appendChild(btn);
            navList.appendChild(li);
        });
        App.updateProgressBar();
    },

    updateProgressBar: () => {
        const completed = Storage.getCompleted().length;
        const total = App.lessons.length;
        const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
        document.getElementById('overall-progress').style.width = `${percent}%`;
        document.getElementById('completed-count').textContent = percent;
    },

    // Reuse storage logic via global Storage object (loaded from js/storage.js which we assume is shared or copied)
    // Actually we need to copy storage.js too or reference it. For now assuming copied.
    loadProgress: () => {
        App.updateProgressBar();
    }
};

document.addEventListener('DOMContentLoaded', App.init);
