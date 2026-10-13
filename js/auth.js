/**
 * CampusEats - Auth Page Logic (Student Login / Signup)
 * Depends on: appwrite.js, appwrite-auth.js (loaded before this)
 */

const errorMsg = document.getElementById('errorMsg');
const successMsg = document.getElementById('successMsg');

// ─── Tab Switching ─────────────────────────────────────────

function switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

    if (tab === 'login') {
        document.querySelector('.auth-tab:first-child').classList.add('active');
        document.getElementById('loginTab').classList.add('active');
    } else {
        document.querySelector('.auth-tab:last-child').classList.add('active');
        document.getElementById('signupTab').classList.add('active');
    }

    hideMessages();
}

function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
    successMsg.classList.add('hidden');
}

function showSuccess(msg) {
    successMsg.textContent = msg;
    successMsg.classList.remove('hidden');
    errorMsg.classList.add('hidden');
}

function hideMessages() {
    errorMsg.classList.add('hidden');
    successMsg.classList.add('hidden');
}

function setButtonLoading(btn, loading) {
    if (loading) {
        btn.dataset.originalText = btn.textContent;
        btn.innerHTML = '<span class="loading-spinner"></span> Please wait...';
        btn.disabled = true;
    } else {
        btn.textContent = btn.dataset.originalText || btn.textContent;
        btn.disabled = false;
    }
}

// ─── Check if Already Logged In ────────────────────────────

(async () => {
    const user = await AppwriteAuth.getCurrentStudent();
    if (user) {
        window.location.href = 'locations.html';
    }
})();

// ─── Login Form ────────────────────────────────────────────

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();

    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');

    if (!email.endsWith('@vitstudent.ac.in')) {
        showError('Email must end with @vitstudent.ac.in');
        return;
    }

    setButtonLoading(btn, true);

    const result = await AppwriteAuth.loginStudent(email, password);

    if (result.success) {
        window.location.href = 'locations.html';
    } else {
        showError(result.message);
        setButtonLoading(btn, false);
    }
});

// ─── Signup Form ───────────────────────────────────────────

document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();

    const regNo = document.getElementById('signupRegNo').value.trim().toUpperCase();
    const email = document.getElementById('signupEmail').value.trim().toLowerCase();
    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirm').value;
    const btn = document.getElementById('signupBtn');

    // Validations
    if (regNo.length < 8) {
        showError('Registration Number must be at least 8 characters.');
        return;
    }

    if (!email.endsWith('@vitstudent.ac.in')) {
        showError('Email must end with @vitstudent.ac.in');
        return;
    }

    if (password.length < 8) {
        showError('Password must be at least 8 characters.');
        return;
    }

    if (password !== confirm) {
        showError('Passwords do not match.');
        return;
    }

    setButtonLoading(btn, true);

    const result = await AppwriteAuth.signupStudent(regNo, email, password);

    if (result.success) {
        // Auto-login happens inside signupStudent, redirect directly
        window.location.href = 'locations.html';
    } else {
        showError(result.message);
        setButtonLoading(btn, false);
    }
});
