async function handleLogout() {
    if (!confirm('Are you sure you want to log out?')) return;
    
    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        if (result.success) {
            window.location.href = '/admin/login';
        } else {
            alert('Logout failed: ' + result.message);
        }
    } catch (error) {
        console.error('Logout error:', error);
        alert('An error occurred during logout. Please try again.');
    }
}

// Update the logout link in the sidebar if it exists
document.addEventListener('DOMContentLoaded', () => {
    const logoutLinks = document.querySelectorAll('a[href="/"]');
    logoutLinks.forEach(link => {
        if (link.textContent.trim().toLowerCase() === 'logout' || link.querySelector('.fa-right-from-bracket')) {
            link.href = 'javascript:void(0)';
            link.addEventListener('click', (e) => {
                e.preventDefault();
                handleLogout();
            });
        }
    });

    // Also update the username if the element exists
    const usernameElement = document.querySelector('.px-5.py-4.border-b.border-gray-100 p.text-gray-800');
    if (usernameElement) {
        fetch('/api/check-auth')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.username) {
                    usernameElement.textContent = data.username;
                }
            })
            .catch(err => console.error('Error fetching auth status:', err));
    }
});
