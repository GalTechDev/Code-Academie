const STORAGE_KEY = 'sql_master_progress';

const Storage = {
    // Get all completed exercise IDs
    getCompleted: () => {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    },

    // Mark an exercise as completed
    markComplete: (exerciseId) => {
        const completed = Storage.getCompleted();
        if (!completed.includes(exerciseId)) {
            completed.push(exerciseId);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
        }
    },

    // Check if specific exercise is done
    isComplete: (exerciseId) => {
        const completed = Storage.getCompleted();
        return completed.includes(exerciseId);
    },

    // Reset all progress
    reset: () => {
        localStorage.removeItem(STORAGE_KEY);
    }
};
