// Theme toggle with persistence and accessible aria-pressed
(function () {
    const root = document.documentElement;
    const btn = document.getElementById('theme-toggle');

    function currentPrefersDark() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    function getInitialTheme() {
        const saved = localStorage.getItem('theme'); // 'light' | 'dark' | null
        if (saved === 'light' || saved === 'dark') return saved;
        return currentPrefersDark() ? 'dark' : 'light';
    }

    function apply(theme) {
        root.setAttribute('data-theme', theme);
        if (btn) btn.setAttribute('aria-pressed', theme === 'dark');
    }

    // Initialize
    apply(getInitialTheme());

    // Toggle on click
    if (btn) {
        btn.addEventListener('click', () => {
            const next = (root.getAttribute('data-theme') === 'dark') ? 'light' : 'dark';
            localStorage.setItem('theme', next);
            apply(next);
        });
    }

    // If user hasn’t chosen (no localStorage), follow system changes live
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', (e) => {
        if (!localStorage.getItem('theme')) {
            apply(e.matches ? 'dark' : 'light');
        }
    });
})();
