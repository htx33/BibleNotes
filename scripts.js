// Store user data and auth token
let currentUser = JSON.parse(localStorage.getItem('user')) || null;
let authToken = localStorage.getItem('authToken') || null;

// Store verses and notes in memory
let verses = [];
let quietTimeEntries = [];
let sermonNotes = [];

// API Base URL
const API_BASE_URL = 'http://localhost:3005';

// Auth functions
async function login(email, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        const data = await response.json();
        currentUser = data.user;
        authToken = data.token;
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('authToken', data.token);
        
        // Fetch user's data
        await fetchVerses();
        await fetchSermonNotes();
        await fetchQuietTimeEntries();
        
        return data;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

async function register(email, password, name) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password, name })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        const data = await response.json();
        currentUser = data.user;
        authToken = data.token;
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('authToken', data.token);
        return data;
    } catch (error) {
        console.error('Registration error:', error);
        throw error;
    }
}

function logout() {
    currentUser = null;
    authToken = null;
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    verses = [];
    quietTimeEntries = [];
    sermonNotes = [];
    document.querySelector('.container').style.display = 'none';
    document.querySelector('.navbar').style.display = 'none';
    showLoginForm();
}

// API functions with auth headers
async function fetchVerses() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/verses`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        verses = await response.json();
        displayVerses();
    } catch (error) {
        console.error('Error fetching verses:', error);
    }
}

async function saveVerse(verse) {
    try {
        console.log('Attempting to save verse:', verse); // Debug log
        const response = await fetch(`${API_BASE_URL}/api/verses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(verse)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save verse');
        }
        
        const savedVerse = await response.json();
        console.log('Successfully saved verse:', savedVerse); // Debug log
        verses.push(savedVerse);
        displayVerses();
        return savedVerse;
    } catch (error) {
        console.error('Error saving verse:', error);
        throw error;
    }
}

async function deleteVerse(id) {
    try {
        await fetch(`${API_BASE_URL}/api/verses/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        verses = verses.filter(v => v.id !== id);
        displayVerses();
    } catch (error) {
        console.error('Error deleting verse:', error);
    }
}

async function fetchSermonNotes() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/sermon-notes`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        sermonNotes = await response.json();
        displaySermonNotes();
    } catch (error) {
        console.error('Error fetching sermon notes:', error);
    }
}

async function saveSermonNote(note) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/sermon-notes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(note)
        });
        const savedNote = await response.json();
        sermonNotes.push(savedNote);
        displaySermonNotes();
        return savedNote;
    } catch (error) {
        console.error('Error saving sermon note:', error);
        throw error;
    }
}

async function deleteSermonNote(id) {
    try {
        await fetch(`${API_BASE_URL}/api/sermon-notes/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        sermonNotes = sermonNotes.filter(n => n.id !== id);
        displaySermonNotes();
    } catch (error) {
        console.error('Error deleting sermon note:', error);
    }
}

// Bible Reading Functionality
document.addEventListener('DOMContentLoaded', function() {
    displayVerses();
    initializeBibleNavigation();
});

function initializeBibleNavigation() {
    const bookSelect = document.getElementById('bible-book');
    const chapterSelect = document.getElementById('bible-chapter');
    
    // Populate books dropdown
    BIBLE_BOOKS.forEach(book => {
        const option = document.createElement('option');
        option.value = book.name;
        option.textContent = book.name;
        bookSelect.appendChild(option);
    });
    
    // Update chapters when book changes
    bookSelect.addEventListener('change', function() {
        const selectedBook = BIBLE_BOOKS.find(book => book.name === this.value);
        updateChapterSelect(selectedBook.chapters);
    });
    
    // Initialize chapters for first book
    updateChapterSelect(BIBLE_BOOKS[0].chapters);
    
    // Add event listeners for Bible reading
    document.getElementById('read-chapter').addEventListener('click', readChapter);
    document.getElementById('search-bible').addEventListener('click', searchBible);
}

function updateChapterSelect(numChapters) {
    const chapterSelect = document.getElementById('bible-chapter');
    chapterSelect.innerHTML = '';
    
    for (let i = 1; i <= numChapters; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Chapter ${i}`;
        chapterSelect.appendChild(option);
    }
}

async function readChapter() {
    const book = document.getElementById('bible-book').value;
    const chapter = document.getElementById('bible-chapter').value;
    const translation = document.getElementById('bible-translation').value;
    const passage = `${book} ${chapter}`;
    
    try {
        const response = await fetch(`${CONFIG.BIBLE_API_URL}/${encodeURIComponent(passage)}?translation=${translation}`);
        const data = await response.json();
        
        if (data.text) {
            document.getElementById('passage-title').textContent = data.reference;
            document.getElementById('passage-text').innerHTML = formatBibleText(data);
            
            // Show bible content, hide search results
            document.getElementById('bible-content').classList.remove('d-none');
            document.getElementById('search-results').classList.add('d-none');
        } else {
            throw new Error('Passage not found');
        }
    } catch (error) {
        alert('Error loading Bible passage. Please try again.');
        console.error('Error:', error);
    }
}

async function searchBible() {
    const searchTerm = document.getElementById('verse-search').value;
    const translation = document.getElementById('bible-translation').value;
    
    try {
        const response = await fetch(`${CONFIG.BIBLE_API_URL}/${encodeURIComponent(searchTerm)}?translation=${translation}`);
        const data = await response.json();
        
        // Hide bible content, show search results
        document.getElementById('bible-content').classList.add('d-none');
        document.getElementById('search-results').classList.remove('d-none');
        
        if (data.text) {
            displaySearchResults([data]);
        } else {
            displaySearchResults([]);
        }
    } catch (error) {
        displaySearchResults([]); // Show no results found
        console.error('Error:', error);
    }
}

function displaySearchResults(results) {
    const resultsContainer = document.getElementById('results-content');
    resultsContainer.innerHTML = '';
    
    if (results.length === 0) {
        resultsContainer.innerHTML = `
            <div class="alert alert-info">
                No results found. Try searching with a specific Bible reference (e.g., "John 3:16" or "Psalm 23").
            </div>`;
        return;
    }
    
    results.forEach(result => {
        const resultElement = document.createElement('div');
        resultElement.className = 'search-result mb-4';
        resultElement.innerHTML = `
            <h4>${result.reference}</h4>
            <div class="verses-container">
                ${formatBibleText(result)}
            </div>
            <div class="mt-2">
                <button class="btn btn-sm btn-outline-primary quick-add-verse" 
                        data-reference="${result.reference}" 
                        data-text="${result.text.replace(/"/g, '&quot;')}">
                    <i class="bi bi-journal-plus"></i> Quick Add to Journal
                </button>
                <button class="btn btn-sm btn-outline-secondary add-to-journal" 
                        data-reference="${result.reference}" 
                        data-text="${result.text.replace(/"/g, '&quot;')}">
                    <i class="bi bi-journal-text"></i> Add with Categories
                </button>
            </div>
        `;
        resultsContainer.appendChild(resultElement);
    });
    
    // Add event listeners for quick add
    document.querySelectorAll('.quick-add-verse').forEach(button => {
        button.addEventListener('click', function() {
            const verse = {
                id: Date.now(),
                reference: this.dataset.reference,
                text: this.dataset.text,
                categories: [],
                dateAdded: new Date().toISOString()
            };
            
            saveVerse(verse).then(() => {
                alert('Verse added to your journal!');
            }).catch(() => {
                alert('Failed to add verse. Please try again.');
            });
        });
    });
    
    // Add event listeners for add with categories
    document.querySelectorAll('.add-to-journal').forEach(button => {
        button.addEventListener('click', function() {
            // Fill in the add verse form
            document.getElementById('verse-reference').value = this.dataset.reference;
            document.getElementById('verse-text').value = this.dataset.text;
            
            // Scroll to the add verse form
            document.querySelector('.card-header h5').scrollIntoView({ behavior: 'smooth' });
        });
    });
}

function formatBibleText(data) {
    if (!data.verses || data.verses.length === 0) {
        return `<p class="bible-paragraph">${data.text}</p>`;
    }

    return data.verses.map(verse => `
        <div class="verse-container">
            <span class="verse-number">${verse.verse}</span>
            <span class="verse-text">${verse.text}</span>
        </div>
    `).join('');
}

// Add verse reference search functionality
document.getElementById('verse-reference').addEventListener('input', async function() {
    const reference = this.value.trim();
    if (reference) {
        const translation = document.getElementById('bible-translation').value;
        try {
            const response = await fetch(`${CONFIG.BIBLE_API_URL}/${encodeURIComponent(reference)}?translation=${translation}`);
            const data = await response.json();
            
            if (data.text) {
                document.getElementById('verse-text').value = data.text;
            }
        } catch (error) {
            console.error('Error fetching verse:', error);
        }
    }
});

// Handle verse addition UI
document.getElementById('add-season-btn').addEventListener('click', () => {
    document.getElementById('season-input').classList.remove('d-none');
});

document.getElementById('add-mood-btn').addEventListener('click', () => {
    document.getElementById('mood-input').classList.remove('d-none');
});

document.getElementById('add-topic-btn').addEventListener('click', () => {
    document.getElementById('topic-input').classList.remove('d-none');
});

// Handle remove buttons
document.querySelectorAll('.remove-input').forEach(button => {
    button.addEventListener('click', (e) => {
        e.target.closest('.input-group').classList.add('d-none');
        // Clear the input when hiding
        const input = e.target.closest('.input-group').querySelector('input, select');
        if (input) input.value = '';
    });
});

// Handle verse addition
document.getElementById('add-verse').addEventListener('click', async () => {
    const reference = document.getElementById('verse-reference').value.trim();
    const text = document.getElementById('verse-text').value.trim();
    
    if (!reference || !text) {
        alert('Please enter both reference and verse text.');
        return;
    }
    
    const categories = [];
    
    // Get season if present
    const seasonInput = document.querySelector('#season-input input');
    if (!seasonInput.closest('.d-none') && seasonInput.value.trim()) {
        categories.push({ type: 'season', value: seasonInput.value.trim() });
    }
    
    // Get mood if present
    const moodSelect = document.querySelector('#mood-input select');
    if (!moodSelect.closest('.d-none') && moodSelect.value) {
        categories.push({ type: 'mood', value: moodSelect.value });
    }
    
    // Get topic if present
    const topicInput = document.querySelector('#topic-input input');
    if (!topicInput.closest('.d-none') && topicInput.value.trim()) {
        categories.push({ type: 'topic', value: topicInput.value.trim() });
    }
    
    try {
        const verseData = { reference, text, categories, dateAdded: new Date().toISOString() };
        console.log('Sending verse data:', verseData); // Debug log
        await saveVerse(verseData);
        
        // Clear all inputs
        document.getElementById('verse-reference').value = '';
        document.getElementById('verse-text').value = '';
        document.querySelectorAll('.input-group').forEach(group => {
            group.classList.add('d-none');
            const input = group.querySelector('input, select');
            if (input) input.value = '';
        });
        
        alert('Verse added successfully!');
    } catch (error) {
        console.error('Error in add-verse handler:', error); // Debug log
        alert(`Failed to save verse: ${error.message}`);
    }
});

// Display Verses
function displayVerses() {
    const versesList = document.getElementById('verses-list');
    versesList.innerHTML = '';
    
    verses.forEach(verse => {
        const categoriesHtml = verse.categories.map(cat => {
            let icon = '';
            switch(cat.type) {
                case 'season':
                    icon = '<i class="bi bi-calendar-event"></i>';
                    break;
                case 'mood':
                    icon = '<i class="bi bi-emoji-smile"></i>';
                    break;
                case 'topic':
                    icon = '<i class="bi bi-tag"></i>';
                    break;
            }
            return `<span class="badge bg-secondary me-1">${icon} ${cat.type}: ${cat.value}</span>`;
        }).join('');
        
        const verseElement = document.createElement('div');
        verseElement.className = 'card mb-3';
        verseElement.innerHTML = `
            <div class="card-body">
                <h5 class="card-title">${verse.reference}</h5>
                <p class="card-text">${verse.text}</p>
                <div class="categories mb-2">
                    ${categoriesHtml}
                </div>
                <button class="btn btn-sm btn-danger delete-verse" data-id="${verse.id}">Delete</button>
            </div>
        `;
        versesList.appendChild(verseElement);
    });
    
    // Add delete handlers
    document.querySelectorAll('.delete-verse').forEach(button => {
        button.addEventListener('click', function() {
            const id = parseInt(this.dataset.id);
            deleteVerse(id);
        });
    });
}

// Sermon Notes Functionality
function displaySermonNotes() {
    const sermonList = document.getElementById('sermon-notes-list');
    if (!sermonList) return;
    
    sermonList.innerHTML = '';
    
    sermonNotes.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(note => {
        const noteElement = document.createElement('div');
        noteElement.className = 'card mb-3';
        noteElement.innerHTML = `
            <div class="card-body">
                <h5 class="card-title">${note.title}</h5>
                <h6 class="card-subtitle mb-2 text-muted">${new Date(note.date).toLocaleDateString()}</h6>
                <p class="card-text">${note.notes}</p>
                <button class="btn btn-sm btn-danger delete-sermon" data-id="${note.id}">Delete</button>
            </div>
        `;
        sermonList.appendChild(noteElement);
    });
    
    // Add delete handlers
    document.querySelectorAll('.delete-sermon').forEach(button => {
        button.addEventListener('click', function() {
            const id = parseInt(this.dataset.id);
            deleteSermonNote(id);
        });
    });
}

// Handle sermon notes submission
document.getElementById('sermon-notes-form')?.addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const note = {
        title: document.getElementById('sermon-title').value,
        date: document.getElementById('sermon-date').value,
        notes: document.getElementById('sermon-notes').value
    };
    
    try {
        await saveSermonNote(note);
        event.target.reset();
        alert('Sermon notes saved successfully!');
    } catch (error) {
        alert('Failed to save sermon notes. Please try again.');
    }
});

// Quiz Mode Functionality
let currentQuizVerse = null;

function startQuiz() {
    if (verses.length < 3) {
        alert('Add at least 3 verses to start the quiz mode!');
        return;
    }
    
    const quizArea = document.getElementById('quiz-area');
    if (!quizArea) return;
    
    // Select a random verse that's different from the current one
    let randomVerse;
    do {
        randomVerse = verses[Math.floor(Math.random() * verses.length)];
    } while (currentQuizVerse && randomVerse.id === currentQuizVerse.id);
    
    currentQuizVerse = randomVerse;
    
    quizArea.innerHTML = `
        <div class="quiz-question mt-4">
            <h5>Complete this verse:</h5>
            <p class="verse-reference">${randomVerse.reference}</p>
            <textarea class="form-control mb-3" id="quiz-answer" rows="3" 
                placeholder="Type the verse..."></textarea>
            <div class="d-flex gap-2">
                <button class="btn btn-primary" onclick="checkAnswer()">Check Answer</button>
                <button class="btn btn-secondary" onclick="showAnswer()">Show Answer</button>
                <button class="btn btn-success" onclick="nextQuestion()">Next Verse</button>
            </div>
            <div id="quiz-feedback" class="mt-3"></div>
        </div>
    `;
}

function checkAnswer() {
    if (!currentQuizVerse) return;
    
    const userAnswer = document.getElementById('quiz-answer').value;
    const similarity = calculateSimilarity(
        userAnswer.toLowerCase().trim(),
        currentQuizVerse.text.toLowerCase().trim()
    );
    
    const feedbackDiv = document.getElementById('quiz-feedback');
    
    if (similarity > 0.8) {
        feedbackDiv.innerHTML = `
            <div class="alert alert-success">
                <strong>Excellent!</strong> Your answer matches the verse very closely!
            </div>
        `;
    } else if (similarity > 0.6) {
        feedbackDiv.innerHTML = `
            <div class="alert alert-warning">
                <strong>Close!</strong> You have the main idea, but some details are different.
                <hr>
                <strong>The exact verse is:</strong><br>
                ${currentQuizVerse.text}
            </div>
        `;
    } else {
        feedbackDiv.innerHTML = `
            <div class="alert alert-danger">
                <strong>Keep practicing!</strong> The verse is quite different.
                <hr>
                <strong>The exact verse is:</strong><br>
                ${currentQuizVerse.text}
            </div>
        `;
    }
}

function showAnswer() {
    if (!currentQuizVerse) return;
    
    const feedbackDiv = document.getElementById('quiz-feedback');
    feedbackDiv.innerHTML = `
        <div class="alert alert-info">
            <strong>${currentQuizVerse.reference}:</strong><br>
            ${currentQuizVerse.text}
        </div>
    `;
}

function nextQuestion() {
    startQuiz();
}

// String similarity calculation for quiz
function calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    return (longer.length - editDistance(longer, shorter)) / longer.length;
}

function editDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill().map(() => 
        Array(str1.length + 1).fill(0)
    );
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
        for (let i = 1; i <= str1.length; i++) {
            if (str1[i-1] === str2[j-1]) {
                matrix[j][i] = matrix[j-1][i-1];
            } else {
                matrix[j][i] = Math.min(
                    matrix[j-1][i-1] + 1,
                    matrix[j][i-1] + 1,
                    matrix[j-1][i] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

// Initialize everything when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Set current date for date inputs
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(input => {
        input.value = today;
    });

    // Check if user is logged in
    if (currentUser && authToken) {
        fetchVerses();
        fetchSermonNotes();
        fetchQuietTimeEntries();
        document.getElementById('user-name').textContent = `Welcome, ${currentUser.name}`;
        document.querySelector('.container').style.display = 'block';
        document.querySelector('.navbar').style.display = 'flex';
    } else {
        document.querySelector('.container').style.display = 'none';
        document.querySelector('.navbar').style.display = 'none';
        showLoginForm();
    }
});

// Add login form HTML
function showLoginForm() {
    const mainContent = document.querySelector('main') || document.body;
    const loginHtml = `
        <div class="container mt-5">
            <div class="row justify-content-center">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-body">
                            <h2 class="card-title text-center mb-4">Login to Bible Verse Journal</h2>
                            <form id="login-form">
                                <div class="mb-3">
                                    <label for="email" class="form-label">Email</label>
                                    <input type="email" class="form-control" id="email" required>
                                </div>
                                <div class="mb-3">
                                    <label for="password" class="form-label">Password</label>
                                    <input type="password" class="form-control" id="password" required>
                                </div>
                                <button type="submit" class="btn btn-primary w-100">Login</button>
                            </form>
                            <hr>
                            <div class="text-center">
                                <p class="mb-2">Don't have an account? <a href="#" id="show-register">Register</a></p>
                                <p><a href="#" id="show-forgot-password">Forgot Password?</a></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Create a new div for the login form
    const loginDiv = document.createElement('div');
    loginDiv.id = 'login-container';
    loginDiv.innerHTML = loginHtml;

    // Insert the login form before the main container
    const mainContainer = document.querySelector('.container');
    mainContainer.parentNode.insertBefore(loginDiv, mainContainer);

    // Add event listeners
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await login(
                document.getElementById('email').value,
                document.getElementById('password').value
            );
            document.getElementById('login-container').remove();
            document.querySelector('.container').style.display = 'block';
            document.querySelector('.navbar').style.display = 'flex';
            document.getElementById('user-name').textContent = `Welcome, ${currentUser.name}`;
        } catch (error) {
            alert(error.message);
        }
    });

    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        showRegisterForm();
    });

    document.getElementById('show-forgot-password').addEventListener('click', (e) => {
        e.preventDefault();
        showForgotPasswordForm();
    });
}

function showForgotPasswordForm() {
    const loginContainer = document.getElementById('login-container');
    const forgotPasswordHtml = `
        <div class="container mt-5">
            <div class="row justify-content-center">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-body">
                            <h2 class="card-title text-center mb-4">Reset Password</h2>
                            <p class="text-center mb-4">Enter your email address and we'll send you a link to reset your password.</p>
                            <form id="forgot-password-form">
                                <div class="mb-3">
                                    <label for="email" class="form-label">Email</label>
                                    <input type="email" class="form-control" id="email" required>
                                </div>
                                <button type="submit" class="btn btn-primary w-100">Send Reset Link</button>
                            </form>
                            <hr>
                            <p class="text-center">
                                <a href="#" id="back-to-login">Back to Login</a>
                            </p>
                            <div id="reset-message" class="mt-3 text-center"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    loginContainer.innerHTML = forgotPasswordHtml;

    // Add event listeners
    document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const messageDiv = document.getElementById('reset-message');

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                messageDiv.className = 'text-success';
                messageDiv.textContent = 'Password reset link has been sent to your email';
            } else {
                messageDiv.className = 'text-danger';
                messageDiv.textContent = data.error || 'Error sending reset link';
            }
        } catch (error) {
            messageDiv.className = 'text-danger';
            messageDiv.textContent = 'Error sending reset link';
        }
    });

    document.getElementById('back-to-login').addEventListener('click', (e) => {
        e.preventDefault();
        showLoginForm();
    });
}

function showRegisterForm() {
    const loginContainer = document.getElementById('login-container');
    const registerHtml = `
        <div class="container mt-5">
            <div class="row justify-content-center">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-body">
                            <h2 class="card-title text-center mb-4">Register for Bible Verse Journal</h2>
                            <form id="register-form">
                                <div class="mb-3">
                                    <label for="name" class="form-label">Name</label>
                                    <input type="text" class="form-control" id="name" required>
                                </div>
                                <div class="mb-3">
                                    <label for="email" class="form-label">Email</label>
                                    <input type="email" class="form-control" id="email" required>
                                </div>
                                <div class="mb-3">
                                    <label for="password" class="form-label">Password</label>
                                    <input type="password" class="form-control" id="password" required>
                                </div>
                                <button type="submit" class="btn btn-primary w-100">Register</button>
                            </form>
                            <hr>
                            <p class="text-center">Already have an account? <a href="#" id="show-login">Login</a></p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    loginContainer.innerHTML = registerHtml;

    // Add event listeners
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await register(
                document.getElementById('email').value,
                document.getElementById('password').value,
                document.getElementById('name').value
            );
            document.getElementById('login-container').remove();
            document.querySelector('.container').style.display = 'block';
            document.querySelector('.navbar').style.display = 'flex';
            document.getElementById('user-name').textContent = `Welcome, ${currentUser.name}`;
        } catch (error) {
            alert(error.message);
        }
    });

    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        showLoginForm();
    });
}

function showMainContent() {
    document.getElementById('login-container')?.remove();
    document.querySelector('.container').style.display = 'block';
    document.querySelector('.navbar').style.display = 'flex';
    if (currentUser) {
        document.getElementById('user-name').textContent = `Welcome, ${currentUser.name}`;
    }
}
