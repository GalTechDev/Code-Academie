// Main Application Logic
const App = {
    lessons: [],
    currentLesson: null,
    db: null,

    init: async () => {
        try {
            // Load Content
            const response = await fetch('data/content.json');
            const data = await response.json();
            App.lessons = data.lessons;

            // Initialize DB
            App.db = await SqlLoader.init();

            // Setup UI
            App.renderNavigation();
            App.bindEvents();
            App.loadProgress();

            // Load first lesson or last active
            App.loadLesson(App.lessons[0].id);

            // Hide loading overlay
            document.getElementById('loading-overlay').classList.add('hidden');

        } catch (err) {
            console.error("Initialization error:", err);
            document.getElementById('loading-overlay').innerHTML = `<div class="loading-content"><p style="color:#ef4444;">Erreur: ${err.message}</p></div>`;
        }
    },

    bindEvents: () => {
        // Run Code Button
        document.getElementById('run-btn').addEventListener('click', App.runUserQuery);

        // Ctrl+Enter in Textarea
        document.getElementById('sql-editor').addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                App.runUserQuery();
            }
        });

        // Tab Switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;

                // Update tab buttons
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update tab content
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                document.getElementById(`tab-${tabName}`).classList.add('active');
            });
        });
    },

    renderNavigation: () => {
        const navList = document.getElementById('lesson-list');
        navList.innerHTML = ''; // Clear

        let lastCategory = '';

        App.lessons.forEach(lesson => {
            // Category Header
            if (lesson.category !== lastCategory) {
                const li = document.createElement('li');
                li.className = 'nav-header';
                li.textContent = lesson.category;
                navList.appendChild(li);
                lastCategory = lesson.category;
            }

            // Lesson Item
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.className = 'nav-btn';
            btn.dataset.id = lesson.id;
            btn.textContent = lesson.title;
            btn.onclick = () => App.loadLesson(lesson.id);

            // Check if completed
            if (Storage.isComplete(lesson.exercise.id)) {
                btn.classList.add('completed');
            }

            li.appendChild(btn);
            navList.appendChild(li);
        });

        App.updateProgressBar();
    },


    setupHint: (lesson) => {
        const btn = document.getElementById('hint-btn');
        const btnText = document.getElementById('hint-btn-text');
        const hintContentEl = document.getElementById('hint-content');
        const hintBox = document.getElementById('lesson-hint');

        // Clear previous state
        if (App.hintTimer) clearInterval(App.hintTimer);
        hintBox.classList.add('hidden');

        if (!lesson.exercise || !lesson.exercise.hint) {
            if (btn) btn.style.display = 'none';
            return;
        }

        if (btn) {
            btn.style.display = 'flex';
            btn.classList.remove('unlocked', 'locked');
            btn.classList.add('locked');
            btn.disabled = true;

            let timeLeft = 10; // 10 seconds delay
            btnText.textContent = `Indice (${timeLeft}s)`;
            const lockIcon = btn.querySelector('.lock-icon');
            if (lockIcon) lockIcon.textContent = '🔒';

            // Timer
            App.hintTimer = setInterval(() => {
                timeLeft--;
                if (timeLeft <= 0) {
                    clearInterval(App.hintTimer);
                    btn.classList.remove('locked');
                    btn.classList.add('unlocked');
                    btn.disabled = false;
                    btnText.textContent = "Révéler l'indice";
                    if (lockIcon) lockIcon.textContent = '🔓';
                } else {
                    btnText.textContent = `Indice (${timeLeft}s)`;
                }
            }, 1000);

            // Click Handler
            btn.onclick = () => {
                if (!btn.disabled) {
                    hintContentEl.textContent = lesson.exercise.hint;
                    hintBox.classList.remove('hidden');
                    btn.style.display = 'none';
                }
            };
        }
    },

    renderSchema: () => {
        const schemaDiv = document.getElementById('db-schema');
        if (!schemaDiv) return;
        schemaDiv.innerHTML = '';

        try {
            // Get list of tables
            const tablesRes = App.db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");

            if (tablesRes.length === 0) {
                schemaDiv.innerHTML = '<div class="schema-empty">Aucune table</div>';
                return;
            }

            const tables = tablesRes[0].values.map(v => v[0]);

            tables.forEach(tableName => {
                // Get columns for table
                const colsRes = App.db.exec(`PRAGMA table_info(${tableName})`);
                const cols = colsRes[0].values.map(v => v[1]); // name is index 1

                const tableEl = document.createElement('div');
                tableEl.className = 'schema-table';

                let colHtml = '';
                cols.forEach(c => colHtml += `<li>${c}</li>`);

                tableEl.innerHTML = `
                    <div class="schema-table-name">${tableName}</div>
                    <ul class="schema-columns">${colHtml}</ul>
                `;
                schemaDiv.appendChild(tableEl);
            });
        } catch (err) {
            console.error("Schema render error", err);
        }
    },

    loadLesson: (lessonId) => {
        const lesson = App.lessons.find(l => l.id === lessonId);
        if (!lesson) return;

        App.currentLesson = lesson;

        // Reset DB and run setup for this lesson
        App.db = SqlLoader.resetAndSetup(lesson.setup);

        // Update Active Nav
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.id === lessonId);
        });

        // Update Header
        document.getElementById('lesson-title').textContent = lesson.title;
        // document.getElementById('lesson-description').textContent = lesson.instruction || "Lisez la théorie et faites l'exercice.";

        // Render Schema
        App.renderSchema();

        // Update Instruction Box
        const instructionEl = document.getElementById('lesson-instruction');
        if (instructionEl) {
            instructionEl.textContent = lesson.exercise.instruction || lesson.instruction || "Lisez la théorie ci-dessous.";
        }

        // Setup Hint Button
        App.setupHint(lesson);

        // We just ensure the content exists for when it is revealed
        const hintContent = document.getElementById('hint-content');
        if (lesson.exercise && lesson.exercise.hint) {
            hintContent.textContent = lesson.exercise.hint;
        }

        // Update Theory (Parse Markdown - simple implementation)
        document.getElementById('theory-content').innerHTML = marked.parse(lesson.content);

        // Reset Editor
        const editor = document.getElementById('sql-editor');
        editor.value = lesson.exercise.placeholder || '';
        document.getElementById('feedback-msg').className = 'feedback hidden';
        document.getElementById('results-output').innerHTML = '<div class="empty-state">La base de données a été réinitialisée pour cet exercice. Exécutez une requête pour voir les résultats.</div>';
        document.getElementById('row-count').textContent = '0 lignes';

        // Optionally run a hidden select to check if setup worked? No need, user will explore.
    },

    runUserQuery: () => {
        const sql = document.getElementById('sql-editor').value;
        const feedback = document.getElementById('feedback-msg');

        if (!sql.trim()) {
            feedback.textContent = "Veuillez entrer une requête SQL.";
            feedback.className = 'feedback error';
            feedback.classList.remove('hidden');
            return;
        }

        try {
            // Execute Query
            const results = App.db.exec(sql);

            // Render Results
            if (results.length > 0) {
                App.renderTable(results[0]);

                // Validate Exercise
                App.validateExercise(sql, results[0]);
            } else {
                document.getElementById('results-output').innerHTML = '<div class="empty-state">Aucun résultat retourné (ou commande sans retour).</div>';
                document.getElementById('row-count').textContent = '0 lignes';
                // Still validate if query was just an update/insert empty result
                App.validateExercise(sql, null);
            }

        } catch (err) {
            feedback.textContent = `Erreur SQL : ${err.message}`;
            feedback.className = 'feedback error';
            feedback.classList.remove('hidden');
        }
    },

    renderTable: (data) => {
        const container = document.getElementById('results-output');
        const columns = data.columns;
        const values = data.values;

        let html = '<table><thead><tr>';
        columns.forEach(col => html += `<th>${col}</th>`);
        html += '</tr></thead><tbody>';

        values.forEach(row => {
            html += '<tr>';
            row.forEach(cell => html += `<td>${cell}</td>`);
            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
        document.getElementById('row-count').textContent = `${values.length} lignes`;
    },

    validateExercise: (userSql, userResults) => {
        if (!App.currentLesson || !App.currentLesson.exercise) return;

        const exercise = App.currentLesson.exercise;
        const feedback = document.getElementById('feedback-msg');

        // Simple validation strategy: Run expected SQL and compare results
        // Note: Ideally we compare the structure of results, not just row count

        try {
            const expectedRes = App.db.exec(exercise.validation.expectedSql);

            if (!userResults && expectedRes.length === 0) {
                // Both empty/no-result
                App.markSuccess(exercise.id);
                return;
            }

            if (!userResults || expectedRes.length === 0) {
                // Mismatch
                feedback.textContent = "Ce n'est pas tout à fait ça. Essayez encore.";
                feedback.className = 'feedback error';
                feedback.classList.remove('hidden');
                return;
            }

            // Compare stringified results (simple equality check)
            // Limitations: order might differ if ORDER BY not enforced.
            // For a basic app, strict comparison is safer.
            const userJson = JSON.stringify(userResults.values);
            const expectedJson = JSON.stringify(expectedRes[0].values);

            if (userJson === expectedJson) {
                App.markSuccess(exercise.id);
            } else {
                feedback.textContent = `Résultat incorrect. Attendu : ${expectedRes[0].values.length} lignes. Obtenu : ${userResults.values.length} lignes. (Vérifiez aussi les colonnes et le tri)`;
                feedback.className = 'feedback error';
                feedback.classList.remove('hidden');
            }

        } catch (err) {
            console.error("Validation error", err);
        }
    },

    markSuccess: (exerciseId) => {
        const feedback = document.getElementById('feedback-msg');
        feedback.textContent = "🎉 Bravo ! Exercice réussi.";
        feedback.className = 'feedback success';
        feedback.classList.remove('hidden');

        // Save Progress
        Storage.markComplete(exerciseId);

        // Update UI
        App.renderNavigation();
    },

    loadProgress: () => {
        App.updateProgressBar();
    },

    updateProgressBar: () => {
        const completed = Storage.getCompleted().length;
        const total = App.lessons.length; // Assuming 1 exercise per lesson
        const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

        document.getElementById('overall-progress').style.width = `${percent}%`;
        document.getElementById('completed-count').textContent = percent;
    }
};

// Start
document.addEventListener('DOMContentLoaded', App.init);
