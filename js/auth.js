// Authentication management
const AUTH_KEYS = {
    currentUser: 'mrchooks-current-user',
    users: 'mrchooks-users'
};



function initAuth() {
    // Initialize default users if none exist
    const users = JSON.parse(localStorage.getItem(AUTH_KEYS.users) || '[]');
    
    if (users.length === 0) {
        const defaultUsers = [
            {
                id: 'admin-1',
                username: 'admin',
                password: 'admin123',
                role: 'admin',
                name: 'Administrator'
            },
            {
                id: 'employee-1',
                username: 'employee',
                password: 'employee123',
                role: 'employee',
                name: 'Employee'
            }
        ];
        
        localStorage.setItem(AUTH_KEYS.users, JSON.stringify(defaultUsers));
    }
}

function login(username, password, role) {
    const users = JSON.parse(localStorage.getItem(AUTH_KEYS.users) || '[]');
    const user = users.find(u => 
        u.username === username && 
        u.password === password && 
        u.role === role
    );
    
    if (user) {
        const userSession = {
            id: user.id,
            username: user.username,
            role: user.role,
            name: user.name,
            loginTime: new Date().toISOString()
        };
        
        localStorage.setItem(AUTH_KEYS.currentUser, JSON.stringify(userSession));
        return userSession;
    }
    
    return null;
}

function logout() {
    localStorage.removeItem(AUTH_KEYS.currentUser);
    window.location.href = 'login.html';
}

function getCurrentUser() {
    return JSON.parse(localStorage.getItem(AUTH_KEYS.currentUser) || 'null');
}

function requireAuth(requiredRole = null) {
    const user = getCurrentUser();
    
    if (!user) {
        window.location.href = 'login.html';
        return null;
    }
    
    if (requiredRole && user.role !== requiredRole) {
        window.location.href = 'login.html';
        return null;
    }
    
    return user;
}

// Initialize auth when script loads
initAuth();

// Login form handler
if (document.getElementById('login-form')) {
    const roleButtons = document.querySelectorAll('.btn-role');
    let selectedRole = 'admin'; // Default role

    roleButtons.forEach(button => {
        button.addEventListener('click', () => {
            roleButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            selectedRole = button.dataset.role;
        });
    });

    document.getElementById('login-form').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        const user = login(username, password, selectedRole);
        
        if (user) {
            if (user.role === 'admin') {
                window.location.href = 'index.html';
            } else {
                window.location.href = 'employee.html';
            }
        } else {
            alert('Invalid credentials! Please try again.');
        }
    });
}