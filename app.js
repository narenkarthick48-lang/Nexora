// ============================================================
// NEXORA - Firebase Connected Application
// app.js
// ============================================================

// -------------------- FIREBASE IMPORTS --------------------

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment
} from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// FIREBASE CONFIG
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyAx6SF8QivGZF9C6VN967Glqb8QHXhBbec",
  authDomain: "nexora-68fa0.firebaseapp.com",
  projectId: "nexora-68fa0",
  storageBucket: "nexora-68fa0.firebasestorage.app",
  messagingSenderId: "493621417467",
  appId: "1:493621417467:web:46f29a85441ed06fab675e",
  measurementId: "G-4MNJ0NX059"
};


// ============================================================
// INITIALIZE FIREBASE
// ============================================================

const firebaseApp = initializeApp(firebaseConfig);

const auth = getAuth(firebaseApp);

const db = getFirestore(firebaseApp);

const googleProvider = new GoogleAuthProvider();


// ============================================================
// GLOBAL STATE
// ============================================================

let currentUser = null;

let currentUserProfile = null;

let activePage = "home";

let feedUnsubscribe = null;

let chatsUnsubscribe = null;

let activeChatUnsubscribe = null;


// ============================================================
// DOM HELPERS
// ============================================================

const appRoot = document.getElementById("app");

const toastElement = document.getElementById("toast");


function escapeHTML(value) {

  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function showToast(message) {

  if (!toastElement) {
    console.log(message);
    return;
  }

  toastElement.textContent = message;

  toastElement.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {

    toastElement.classList.remove("show");

  }, 2500);
}


function getInitial(name) {

  if (!name) {
    return "N";
  }

  return name.charAt(0).toUpperCase();
}


function avatarHTML(name) {

  return `
    <div class="avatar">
      ${escapeHTML(getInitial(name))}
    </div>
  `;
}


function formatTime(timestamp) {

  if (!timestamp) {
    return "Just now";
  }

  try {

    const date = timestamp.toDate
      ? timestamp.toDate()
      : new Date(timestamp);

    return date.toLocaleString();

  } catch (error) {

    return "Just now";
  }
}


// ============================================================
// AUTH STATE
// ============================================================

onAuthStateChanged(auth, async (user) => {

  currentUser = user;

  if (!user) {

    currentUserProfile = null;

    cleanupListeners();

    renderAuthScreen();

    return;
  }

  try {

    await ensureUserProfile(user);

    await loadCurrentUserProfile();

    renderMainApp();

  } catch (error) {

    console.error(error);

    showToast(error.message);

  }

});


// ============================================================
// CREATE USER PROFILE
// ============================================================

async function ensureUserProfile(user) {

  const userRef = doc(db, "users", user.uid);

  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists()) {

    const displayName =
      user.displayName ||
      user.email?.split("@")[0] ||
      "NEXORA User";

    const username =
      displayName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 20)
      + user.uid.slice(0, 5);

    await setDoc(userRef, {

      uid: user.uid,

      name: displayName,

      username: username,

      email: user.email || "",

      bio: "New on NEXORA.",

      photoURL: user.photoURL || "",

      followers: [],

      following: [],

      createdAt: serverTimestamp()

    });

  }

}


// ============================================================
// LOAD CURRENT PROFILE
// ============================================================

async function loadCurrentUserProfile() {

  if (!currentUser) {
    return;
  }

  const userRef =
    doc(db, "users", currentUser.uid);

  const snapshot =
    await getDoc(userRef);

  if (snapshot.exists()) {

    currentUserProfile =
      snapshot.data();

  }

}


// ============================================================
// AUTH SCREEN
// ============================================================

function renderAuthScreen() {

  if (!appRoot) {
    return;
  }

  appRoot.innerHTML = `

    <section class="auth">

      <div class="auth-card">

        <h1>NEXORA</h1>

        <p>
          One place for people, posts and conversations.
        </p>

        <div class="row">

          <button
            class="primary grow"
            id="loginTab"
          >
            Login
          </button>

          <button
            class="ghost grow"
            id="signupTab"
          >
            Sign Up
          </button>

        </div>

        <form
          id="authForm"
          style="margin-top:18px"
        >

          <input
            id="nameInput"
            placeholder="Display name"
            style="display:none;margin-bottom:10px"
          >

          <input
            id="emailInput"
            type="email"
            placeholder="Email"
            required
            style="margin-bottom:10px"
          >

          <input
            id="passwordInput"
            type="password"
            placeholder="Password"
            minlength="6"
            required
          >

          <button
            class="primary"
            style="width:100%;margin-top:14px"
            id="authButton"
          >
            Login
          </button>

        </form>

        <div
          style="
            text-align:center;
            margin:16px 0;
            color:#8d98b3
          "
        >
          OR
        </div>

        <button
          class="ghost"
          style="width:100%"
          id="googleLogin"
        >
          Continue with Google
        </button>

      </div>

    </section>
  `;


  let authMode = "login";


  const loginTab =
    document.getElementById("loginTab");

  const signupTab =
    document.getElementById("signupTab");

  const nameInput =
    document.getElementById("nameInput");

  const authButton =
    document.getElementById("authButton");


  loginTab.onclick = () => {

    authMode = "login";

    nameInput.style.display = "none";

    authButton.textContent = "Login";

  };


  signupTab.onclick = () => {

    authMode = "signup";

    nameInput.style.display = "block";

    authButton.textContent = "Create Account";

  };


  document
    .getElementById("authForm")
    .addEventListener(
      "submit",
      async (event) => {

        event.preventDefault();

        const email =
          document
            .getElementById("emailInput")
            .value
            .trim();

        const password =
          document
            .getElementById("passwordInput")
            .value;

        const name =
          document
            .getElementById("nameInput")
            .value
            .trim();

        try {

          authButton.disabled = true;

          if (authMode === "signup") {

            const credential =
              await createUserWithEmailAndPassword(
                auth,
                email,
                password
              );

            if (name) {

              await updateProfile(
                credential.user,
                {
                  displayName: name
                }
              );

            }

            await ensureUserProfile(
              credential.user
            );

            showToast(
              "Account created successfully"
            );

          } else {

            await signInWithEmailAndPassword(
              auth,
              email,
              password
            );

            showToast(
              "Welcome back"
            );

          }

        } catch (error) {

          console.error(error);

          showToast(
            error.message
          );

        } finally {

          authButton.disabled = false;

        }

      }
    );


  document
    .getElementById("googleLogin")
    .onclick =
    async () => {

      try {

        await signInWithPopup(
          auth,
          googleProvider
        );

      } catch (error) {

        console.error(error);

        showToast(
          error.message
        );

      }

    };

}


// ============================================================
// MAIN APP
// ============================================================

function renderMainApp() {

  if (!currentUser) {
    return;
  }

  appRoot.innerHTML = `

    <header class="topbar">

      <div class="brand">
        NEXORA
      </div>

      <div class="row">

        <button
          class="ghost"
          id="notificationsButton"
        >
          🔔
        </button>

        <button
          class="ghost"
          id="logoutButton"
        >
          Logout
        </button>

      </div>

    </header>


    <main>

      <section
        class="page active"
        id="page-home"
      >

        <div class="card">

          <h2>
            Welcome,
            ${escapeHTML(
              currentUserProfile?.name ||
              currentUser.displayName ||
              "User"
            )}
          </h2>

          <button
            class="primary"
            id="createPostShortcut"
          >
            Create Post ✦
          </button>

        </div>

        <div
          id="feed"
          class="feed"
        ></div>

      </section>


      <section
        class="page"
        id="page-discover"
      >

        <div class="card">

          <h2>
            Discover
          </h2>

          <input
            id="searchUsers"
            placeholder="Search people..."
          >

        </div>

        <div
          id="discoverList"
          class="list"
        ></div>

      </section>


      <section
        class="page"
        id="page-create"
      >

        <div class="card">

          <h2>
            Create a Post
          </h2>

          <textarea
            id="postText"
            maxlength="2000"
            placeholder="What's happening?"
          ></textarea>

          <div
            class="row"
            style="margin-top:12px"
          >

            <button
              class="ghost grow"
              id="clearPost"
            >
              Clear
            </button>

            <button
              class="primary grow"
              id="publishPost"
            >
              Publish
            </button>

          </div>

        </div>

      </section>


      <section
        class="page"
        id="page-chats"
      >

        <div class="card">

          <div class="row">

            <h2 class="grow">
              Messages
            </h2>

            <button
              class="primary"
              id="newChat"
            >
              New Chat
            </button>

          </div>

        </div>

        <div
          id="chatList"
          class="list"
        ></div>

      </section>


      <section
        class="page"
        id="page-profile"
      >

        <div
          id="profileView"
        ></div>

      </section>

    </main>


    <nav class="bottom-nav">

      <button
        class="nav-btn active"
        data-page="home"
      >
        Home
      </button>

      <button
        class="nav-btn"
        data-page="discover"
      >
        Discover
      </button>

      <button
        class="nav-btn"
        data-page="create"
      >
        Create
      </button>

      <button
        class="nav-btn"
        data-page="chats"
      >
        Chats
      </button>

      <button
        class="nav-btn"
        data-page="profile"
      >
        Profile
      </button>

    </nav>
  `;


  setupNavigation();


  document
    .getElementById("createPostShortcut")
    .onclick =
    () => {
      navigateTo("create");
    };


  document
    .getElementById("publishPost")
    .onclick =
    publishPost;


  document
    .getElementById("clearPost")
    .onclick =
    () => {

      document
        .getElementById("postText")
        .value = "";

    };


  document
    .getElementById("logoutButton")
    .onclick =
    async () => {

      await signOut(auth);

      showToast(
        "Logged out"
      );

    };


  document
    .getElementById("newChat")
    .onclick =
    showNewChatDialog;


  document
    .getElementById("notificationsButton")
    .onclick =
    () => {

      showToast(
        "Notifications module coming next"
      );

    };


  subscribeToFeed();

}


// ============================================================
// NAVIGATION
// ============================================================

function setupNavigation() {

  const buttons =
    document.querySelectorAll(
      ".nav-btn"
    );


  buttons.forEach(
    (button) => {

      button.onclick =
        () => {

          navigateTo(
            button.dataset.page
          );

        };

    }
  );

}


function navigateTo(pageName) {

  activePage = pageName;


  document
    .querySelectorAll(".page")
    .forEach(
      (page) => {

        page.classList.toggle(
          "active",
          page.id ===
          `page-${pageName}`
        );

      }
    );


  document
    .querySelectorAll(".nav-btn")
    .forEach(
      (button) => {

        button.classList.toggle(
          "active",
          button.dataset.page ===
          pageName
        );

      }
    );


  if (pageName === "discover") {

    renderDiscover();

  }


  if (pageName === "chats") {

    subscribeToChats();

  }


  if (pageName === "profile") {

    renderProfile();

  }

}


// ============================================================
// CREATE POST
// ============================================================

async function publishPost() {

  if (!currentUser) {
    return;
  }


  const textElement =
    document.getElementById(
      "postText"
    );


  const text =
    textElement.value.trim();


  if (!text) {

    showToast(
      "Write something first"
    );

    return;

  }


  try {

    await addDoc(
      collection(
        db,
        "posts"
      ),
      {

        uid:
          currentUser.uid,

        text:
          text,

        likes:
          [],

        commentsCount:
          0,

        createdAt:
          serverTimestamp()

      }
    );


    textElement.value = "";


    showToast(
      "Post published ✦"
    );


    navigateTo(
      "home"
    );

  } catch (error) {

    console.error(error);

    showToast(
      error.message
    );

  }

}


// ============================================================
// REALTIME FEED
// ============================================================

function subscribeToFeed() {

  if (feedUnsubscribe) {

    feedUnsubscribe();

  }


  const postsQuery =
    query(
      collection(
        db,
        "posts"
      ),
      orderBy(
        "createdAt",
        "desc"
      ),
     
