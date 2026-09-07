// ============================================================
// NEXORA - Firebase Connected Application
// app.js  (rebuilt to match index.html structure)
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, addDoc, updateDoc, deleteDoc,
  getDocs, query, where, orderBy, limit, onSnapshot, serverTimestamp,
  arrayUnion, arrayRemove, increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ---------------- FIREBASE CONFIG ----------------
const firebaseConfig = {
  apiKey: "AIzaSyAx6SF8QivGZF9C6VN967Glqb8QHXhBbec",
  authDomain: "nexora-68fa0.firebaseapp.com",
  projectId: "nexora-68fa0",
  storageBucket: "nexora-68fa0.firebasestorage.app",
  messagingSenderId: "493621417467",
  appId: "1:493621417467:web:46f29a85441ed06fab675e",
  measurementId: "G-4MNJ0NX059"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);
const googleProvider = new GoogleAuthProvider();

// ---------------- GLOBAL STATE ----------------
let currentUser = null;
let currentUserProfile = null;
let activeRoute = "home";
let activeFeedTab = "foryou";
let activeCategory = "all";
let activeSettingsTab = "account";
let activeChatId = null;
let activeChatUser = null;
let selectedPostMediaFile = null;
let usersCache = [];

const unsub = {}; // holds active onSnapshot unsubscribe functions per key

function stopListener(key) {
  if (unsub[key]) { unsub[key](); delete unsub[key]; }
}

// ---------------- DOM HELPERS ----------------
const $ = (id) => document.getElementById(id);
const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function escapeHTML(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function getInitial(name) { return name ? name.charAt(0).toUpperCase() : "N"; }

function formatTime(timestamp) {
  if (!timestamp) return "Just now";
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  } catch (e) { return "Just now"; }
}

let toastTimer = null;
function showToast(message, tone = "default") {
  const toast = $("toast");
  if (!toast) { console.log(message); return; }
  $("toastText").textContent = message;
  $("toastIcon").textContent = tone === "error" ? "✕" : "✓";
  toast.classList.remove("hidden");
  requestAnimationFrame(() => toast.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.classList.add("hidden"), 300);
  }, 3000);
}

function showModal(id) { $(id).classList.remove("hidden"); }
function hideModal(id) { $(id).classList.add("hidden"); }

function closeAllFloating() {
  $("createMenu").classList.add("hidden");
  $("profileDropdown").classList.add("hidden");
  $("notificationsPanel").classList.add("hidden");
  $("searchResults").classList.add("hidden");
}

// ============================================================
// BOOT SEQUENCE
// ============================================================
window.addEventListener("DOMContentLoaded", () => {
  bindStaticEvents();
  setTimeout(() => {
    // boot screen stays until onAuthStateChanged resolves; hide it as a safety net after 4s
  }, 4000);
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!user) {
    currentUserProfile = null;
    cleanupListeners();
    $("bootScreen").classList.add("hidden");
    $("mainApp").classList.add("hidden");
    $("authScreen").classList.remove("hidden");
    return;
  }

  try {
    await ensureUserProfile(user);
    await loadCurrentUserProfile();
    $("bootScreen").classList.add("hidden");
    $("authScreen").classList.add("hidden");
    $("mainApp").classList.remove("hidden");
    bindMainAppEvents();
    hydrateTopbarAndSidebar();
    navigateTo("home");
  } catch (error) {
    console.error(error);
    showToast(error.message, "error");
    $("bootScreen").classList.add("hidden");
    $("authScreen").classList.remove("hidden");
  }
});

function cleanupListeners() {
  Object.keys(unsub).forEach(stopListener);
}

// ============================================================
// USER PROFILE
// ============================================================
async function ensureUserProfile(user) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    const displayName = user.displayName || user.email?.split("@")[0] || "NEXORA User";
    const username = displayName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) + user.uid.slice(0, 5);
    await setDoc(userRef, {
      uid: user.uid,
      name: displayName,
      username,
      email: user.email || "",
      bio: "New on NEXORA.",
      location: "",
      website: "",
      photoURL: user.photoURL || "",
      followers: [],
      following: [],
      postCount: 0,
      isPublic: true,
      notifyMessages: true,
      createdAt: serverTimestamp()
    });
  }
}

async function loadCurrentUserProfile() {
  if (!currentUser) return;
  const snap = await getDoc(doc(db, "users", currentUser.uid));
  if (snap.exists()) currentUserProfile = snap.data();
}

function hydrateTopbarAndSidebar() {
  const name = currentUserProfile?.name || currentUser.displayName || "NEXORA User";
  const email = currentUser.email || "";
  const initial = getInitial(name);
  $("topProfileInitial").textContent = initial;
  $("dropdownInitial").textContent = initial;
  $("dropdownName").textContent = name;
  $("dropdownEmail").textContent = email;
  $("composerInitial").textContent = initial;
  const welcomeTitle = $("welcomeTitle");
  if (welcomeTitle) welcomeTitle.textContent = `Good to see you, ${name.split(" ")[0]}.`;
}

// ============================================================
// AUTH SCREEN EVENTS (bound once, screen always in DOM)
// ============================================================
function bindStaticEvents() {
  // ---- Auth tabs ----
  $("loginTab").onclick = () => switchAuthTab("login");
  $("signupTab").onclick = () => switchAuthTab("signup");

  function switchAuthTab(mode) {
    $("loginTab").classList.toggle("active", mode === "login");
    $("signupTab").classList.toggle("active", mode === "signup");
    $("loginForm").classList.toggle("hidden", mode !== "login");
    $("signupForm").classList.toggle("hidden", mode !== "signup");
    $("authMessage").classList.add("hidden");
  }

  // ---- Show/hide password ----
  qsa(".toggle-password").forEach((btn) => {
    btn.onclick = () => {
      const target = $(btn.dataset.target);
      const showing = target.type === "text";
      target.type = showing ? "password" : "text";
      btn.textContent = showing ? "Show" : "Hide";
    };
  });

  function setAuthMessage(text, isError = true) {
    const el = $("authMessage");
    el.textContent = text;
    el.classList.remove("hidden");
    el.classList.toggle("success", !isError);
  }

  // ---- Login ----
  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;
    $("loginBtn").disabled = true;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      showToast("Welcome back to NEXORA");
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      $("loginBtn").disabled = false;
    }
  });

  // ---- Signup ----
  $("signupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("signupName").value.trim();
    const email = $("signupEmail").value.trim();
    const password = $("signupPassword").value;
    if (!$("acceptTerms").checked) {
      setAuthMessage("Please accept the terms to continue.");
      return;
    }
    $("signupBtn").disabled = true;
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      if (name) await updateProfile(credential.user, { displayName: name });
      await ensureUserProfile(credential.user);
      showToast("Account created — welcome to NEXORA");
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      $("signupBtn").disabled = false;
    }
  });

  // ---- Google auth (both buttons do the same popup flow) ----
  const googleHandler = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setAuthMessage(error.message);
    }
  };
  $("googleLoginBtn").onclick = googleHandler;
  $("googleSignupBtn").onclick = googleHandler;

  // ---- Forgot password ----
  $("forgotPasswordBtn").onclick = async () => {
    const email = $("loginEmail").value.trim();
    if (!email) {
      setAuthMessage("Enter your email above first, then tap 'Forgot password?'.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setAuthMessage("Password reset link sent to " + email, false);
    } catch (error) {
      setAuthMessage(error.message);
    }
  };

  // ---- Generic modal close ----
  qsa("[data-close]").forEach((btn) => {
    btn.onclick = () => hideModal(btn.dataset.close);
  });
  qsa(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) backdrop.classList.add("hidden");
    });
  });

  // ---- Toast close ----
  $("toastCloseBtn").onclick = () => $("toast").classList.add("hidden");
}

// ============================================================
// MAIN APP EVENTS (bound once user is authenticated)
// ============================================================
let mainAppBound = false;
function bindMainAppEvents() {
  if (mainAppBound) return;
  mainAppBound = true;

  // ---- Sidebar / mobile menu ----
  $("mobileMenuBtn").onclick = () => $("sidebar").classList.toggle("open");

  // ---- Route buttons (sidebar + dropdown) ----
  qsa("[data-route]").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigateTo(btn.dataset.route);
      $("sidebar").classList.remove("open");
      closeAllFloating();
    });
  });

  // ---- Quick access communities ----
  qsa(".quick-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigateTo("communities");
      showToast(`Opening ${btn.textContent.trim()}`);
    });
  });

  // ---- Profile dropdown ----
  $("profileMenuBtn").onclick = (e) => {
    e.stopPropagation();
    const willOpen = $("profileDropdown").classList.contains("hidden");
    closeAllFloating();
    $("profileDropdown").classList.toggle("hidden", !willOpen);
  };
  $("logoutBtn").onclick = async () => {
    await signOut(auth);
    showToast("Signed out");
  };

  // ---- Notifications ----
  $("notificationBtn").onclick = (e) => {
    e.stopPropagation();
    const willOpen = $("notificationsPanel").classList.contains("hidden");
    closeAllFloating();
    $("notificationsPanel").classList.toggle("hidden", !willOpen);
  };
  $("markAllReadBtn").onclick = markAllNotificationsRead;

  // ---- Create menu (floating) ----
  $("createBtn").onclick = (e) => {
    e.stopPropagation();
    const willOpen = $("createMenu").classList.contains("hidden");
    closeAllFloating();
    $("createMenu").classList.toggle("hidden", !willOpen);
  };
  $("createPostMenuBtn").onclick = () => { closeAllFloating(); openPostModal(); };
  $("createStoryMenuBtn").onclick = () => { closeAllFloating(); showModal("storyModal"); };
  $("createCommunityMenuBtn").onclick = () => { closeAllFloating(); showModal("communityModal"); };
  $("createChatMenuBtn").onclick = () => { closeAllFloating(); openNewChatModal(); };

  // ---- Click outside closes floating panels ----
  document.addEventListener("click", closeAllFloating);

  // ---- Global search ----
  let searchDebounce = null;
  $("globalSearchInput").addEventListener("input", (e) => {
    clearTimeout(searchDebounce);
    const term = e.target.value.trim();
    if (!term) { $("searchResults").classList.add("hidden"); return; }
    searchDebounce = setTimeout(() => runGlobalSearch(term), 300);
  });
  $("globalSearchInput").addEventListener("click", (e) => e.stopPropagation());

  // ---- HOME: composer / feed ----
  $("openPostComposerBtn").onclick = openPostModal;
  $("composerMediaBtn").onclick = () => { openPostModal(); $("postMediaInput").click(); };
  $("composerVideoBtn").onclick = () => { openPostModal(); $("postMediaInput").click(); };
  $("composerFeelingBtn").onclick = () => { openPostModal(); showToast("Tip: describe your feeling in the post text"); };
  $("composerPostBtn").onclick = openPostModal;
  $("refreshFeedBtn").onclick = () => { subscribeFeed(); showToast("Feed refreshed"); };
  $("refreshPeopleBtn").onclick = loadPeopleSuggestions;
  $("viewAllStoriesBtn").onclick = () => showToast("You're viewing all recent stories");
  $("addStoryBtn").onclick = () => showModal("storyModal");

  qsa(".feed-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      qsa(".feed-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      activeFeedTab = tab.dataset.feed;
      renderFeed(currentFeedDocs);
    });
  });

  // ---- Post modal ----
  $("postTextInput").addEventListener("input", () => {
    $("postCharCount").textContent = `${$("postTextInput").value.length} / 2000`;
  });
  $("addPostMediaBtn").onclick = () => $("postMediaInput").click();
  $("postMediaInput").addEventListener("change", handlePostMediaSelect);
  $("submitPostBtn").onclick = publishPost;

  // ---- Story modal ----
  $("publishStoryBtn").onclick = publishStory;

  // ---- Community modal ----
  $("createCommunityBtn").onclick = () => showModal("communityModal");
  $("submitCommunityBtn").onclick = createCommunity;

  // ---- Profile edit modal ----
  $("editProfileBtn").onclick = openEditProfileModal;
  $("editCoverBtn").onclick = openEditProfileModal;
  $("editAvatarBtn").onclick = openEditProfileModal;
  $("settingsEditProfileBtn").onclick = openEditProfileModal;
  $("profileCreatePostBtn").onclick = openPostModal;
  $("saveProfileBtn").onclick = saveProfileChanges;

  // ---- Messages ----
  $("newChatBtn").onclick = openNewChatModal;
  $("startChatFromEmptyBtn").onclick = openNewChatModal;
  $("newChatSearchInput").addEventListener("input", (e) => searchUsersForModal(e.target.value, "newChatUserResults", startChatWithUser));
  $("chatSearchInput").addEventListener("input", (e) => filterChatList(e.target.value));
  $("messageForm").addEventListener("submit", sendMessage);
  $("voiceCallBtn").onclick = () => logCallAndNotify("voice");
  $("videoCallBtn").onclick = () => logCallAndNotify("video");

  // ---- Explore ----
  $("exploreSearchInput").addEventListener("input", (e) => runExploreSearch(e.target.value));
  qsa(".category-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      qsa(".category-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      activeCategory = chip.dataset.category;
      runExploreSearch($("exploreSearchInput").value);
    });
  });

  // ---- Calls ----
  $("startCallBtn").onclick = () => showModal("callModal");
  $("quickVoiceCallBtn").onclick = () => openCallModal("voice");
  $("quickVideoCallBtn").onclick = () => openCallModal("video");
  $("createRoomBtn").onclick = () => openCallModal("room");

  // ---- Settings ----
  qsa(".settings-nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      qsa(".settings-nav-item").forEach((i) => i.classList.remove("active"));
      item.classList.add("active");
      activeSettingsTab = item.dataset.settings;
      qsa(".settings-panel").forEach((p) => p.classList.toggle("active", p.dataset.settingsPanel === activeSettingsTab));
    });
  });
  $("themeSelect").addEventListener("change", (e) => {
    const theme = e.target.value;
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("nexora-theme", theme); } catch (err) {}
    showToast(`Theme set to ${theme}`);
  });
  $("publicProfileToggle").addEventListener("change", async (e) => {
    await updateDoc(doc(db, "users", currentUser.uid), { isPublic: e.target.checked });
    showToast(e.target.checked ? "Profile is public" : "Profile is private");
  });
  $("messageNotificationsToggle").addEventListener("change", async (e) => {
    await updateDoc(doc(db, "users", currentUser.uid), { notifyMessages: e.target.checked });
    showToast("Notification preference saved");
  });
  $("changePasswordBtn").onclick = async () => {
    try {
      await sendPasswordResetEmail(auth, currentUser.email);
      showToast("Password reset link sent to your email");
    } catch (error) { showToast(error.message, "error"); }
  };
  $("settingsLogoutBtn").onclick = async () => { await signOut(auth); showToast("Signed out"); };

  $("themeToggleBtn").onclick = () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("nexora-theme", next); } catch (err) {}
    if ($("themeSelect")) $("themeSelect").value = next;
    showToast(`Theme set to ${next}`);
  };

  try {
    const savedTheme = localStorage.getItem("nexora-theme");
    if (savedTheme) { $("themeSelect").value = savedTheme; document.documentElement.setAttribute("data-theme", savedTheme); }
  } catch (err) {}
}

// ============================================================
// ROUTING
// ============================================================
function navigateTo(routeName) {
  activeRoute = routeName;

  qsa(".view").forEach((view) => view.classList.toggle("active-view", view.dataset.view === routeName));
  qsa(".nav-item[data-route]").forEach((btn) => btn.classList.toggle("active", btn.dataset.route === routeName));

  if (routeName === "home") subscribeFeed();
  if (routeName === "messages") subscribeChats();
  if (routeName === "explore") runExploreSearch("");
  if (routeName === "communities") subscribeCommunities();
  if (routeName === "calls") subscribeCallHistory();
  if (routeName === "bookmarks") subscribeBookmarks();
  if (routeName === "profile") loadProfileView();
  if (routeName === "settings") loadSettingsView();
}

// ============================================================
// POSTS / FEED
// ============================================================
let currentFeedDocs = [];

function openPostModal() {
  $("postAuthorInitial").textContent = getInitial(currentUserProfile?.name);
  $("postAuthorName").textContent = currentUserProfile?.name || "NEXORA User";
  $("postTextInput").value = "";
  $("postCharCount").textContent = "0 / 2000";
  $("postMediaPreview").classList.add("hidden");
  $("postMediaPreview").innerHTML = "";
  selectedPostMediaFile = null;
  showModal("postModal");
}

function handlePostMediaSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  selectedPostMediaFile = file;
  const url = URL.createObjectURL(file);
  const isVideo = file.type.startsWith("video");
  $("postMediaPreview").innerHTML = `
    ${isVideo ? `<video src="${url}" controls></video>` : `<img src="${url}" alt="preview">`}
    <button type="button" id="removePostMediaBtn">×</button>`;
  $("postMediaPreview").classList.remove("hidden");
  $("removePostMediaBtn").onclick = () => {
    selectedPostMediaFile = null;
    $("postMediaInput").value = "";
    $("postMediaPreview").classList.add("hidden");
    $("postMediaPreview").innerHTML = "";
  };
}

async function publishPost() {
  const text = $("postTextInput").value.trim();
  if (!text && !selectedPostMediaFile) { showToast("Write something or add media first", "error"); return; }
  $("submitPostBtn").disabled = true;
  try {
    let mediaURL = "";
    let mediaType = "";
    if (selectedPostMediaFile) {
      const path = `posts/${currentUser.uid}/${Date.now()}_${selectedPostMediaFile.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, selectedPostMediaFile);
      mediaURL = await getDownloadURL(storageRef);
      mediaType = selectedPostMediaFile.type.startsWith("video") ? "video" : "image";
    }
    await addDoc(collection(db, "posts"), {
      uid: currentUser.uid,
      authorName: currentUserProfile?.name || currentUser.displayName || "NEXORA User",
      text, mediaURL, mediaType,
      likes: [], commentsCount: 0,
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, "users", currentUser.uid), { postCount: increment(1) });
    hideModal("postModal");
    showToast("Post published ✦");
    navigateTo("home");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    $("submitPostBtn").disabled = false;
  }
}

function subscribeFeed() {
  stopListener("feed");
  const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(40));
  unsub.feed = onSnapshot(postsQuery, (snapshot) => {
    currentFeedDocs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderFeed(currentFeedDocs);
  }, (error) => console.error("feed error", error));
  loadPeopleSuggestions();
}

function renderFeed(docs) {
  const list = $("feedList");
  let items = docs;
  if (activeFeedTab === "following") {
    const following = currentUserProfile?.following || [];
    items = docs.filter((p) => following.includes(p.uid));
  } else if (activeFeedTab === "trending") {
    items = [...docs].sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
  }

  if (!items.length) {
    list.innerHTML = `<div class="empty-feed"><div class="empty-icon">✦</div><h3>Nothing here yet</h3><p>${activeFeedTab === "following" ? "Follow people to see their posts." : "Be the first to share something."}</p></div>`;
    return;
  }

  list.innerHTML = items.map((post) => {
    const liked = post.likes?.includes(currentUser.uid);
    const media = post.mediaURL
      ? `<div class="post-media">${post.mediaType === "video" ? `<video src="${post.mediaURL}" controls></video>` : `<img src="${post.mediaURL}" alt="post media">`}</div>`
      : "";
    return `
      <article class="post-card" data-post-id="${post.id}">
        <div class="post-head">
          <div class="post-author">
            <div class="profile-avatar"><span>${escapeHTML(getInitial(post.authorName))}</span></div>
            <div><strong>${escapeHTML(post.authorName)}</strong><small>${formatTime(post.createdAt)}</small></div>
          </div>
          <button class="more-btn" type="button">⋯</button>
        </div>
        ${post.text ? `<p class="post-text">${escapeHTML(post.text)}</p>` : ""}
        ${media}
        <div class="post-actions">
          <button class="action-btn like-btn ${liked ? "liked" : ""}" type="button" data-id="${post.id}">${liked ? "♥" : "♡"} Like${post.likes?.length ? " · " + post.likes.length : ""}</button>
          <button class="action-btn comment-btn" type="button">💬 Comment${post.commentsCount ? " · " + post.commentsCount : ""}</button>
          <button class="action-btn share-btn" type="button">↗ Share</button>
          <button class="action-btn save-btn" type="button" data-id="${post.id}">☆ Save</button>
        </div>
      </article>`;
  }).join("");

  qsa(".like-btn", list).forEach((btn) => btn.addEventListener("click", () => toggleLike(btn.dataset.id)));
  qsa(".save-btn", list).forEach((btn) => btn.addEventListener("click", () => savePost(btn.dataset.id)));
  qsa(".comment-btn", list).forEach((btn) => btn.addEventListener("click", () => showToast("Comments are coming soon")));
  qsa(".share-btn", list).forEach((btn) => btn.addEventListener("click", () => showToast("Link copied to clipboard")));
}

async function toggleLike(postId) {
  const post = currentFeedDocs.find((p) => p.id === postId);
  if (!post) return;
  const liked = post.likes?.includes(currentUser.uid);
  const postRef = doc(db, "posts", postId);
  await updateDoc(postRef, { likes: liked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) });
  if (!liked && post.uid !== currentUser.uid) {
    createNotification(post.uid, "like", `${currentUserProfile?.name || "Someone"} liked your post`);
  }
}

async function savePost(postId) {
  const post = currentFeedDocs.find((p) => p.id === postId) || (await getDoc(doc(db, "posts", postId))).data();
  const bookmarkRef = doc(db, "users", currentUser.uid, "bookmarks", postId);
  const existing = await getDoc(bookmarkRef);
  if (existing.exists()) {
    await deleteDoc(bookmarkRef);
    showToast("Removed from saved");
  } else {
    await setDoc(bookmarkRef, { ...post, savedAt: serverTimestamp() });
    showToast("Saved ✦");
  }
}

// ============================================================
// STORIES
// ============================================================
async function publishStory() {
  const text = $("storyTextInput").value.trim();
  const file = $("storyMediaInput").files[0];
  if (!text && !file) { showToast("Add text or media for your story", "error"); return; }
  try {
    let mediaURL = "";
    if (file) {
      const path = `stories/${currentUser.uid}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      mediaURL = await getDownloadURL(storageRef);
    }
    await addDoc(collection(db, "stories"), {
      uid: currentUser.uid,
      authorName: currentUserProfile?.name || "NEXORA User",
      text, mediaURL,
      createdAt: serverTimestamp()
    });
    $("storyTextInput").value = "";
    $("storyMediaInput").value = "";
    hideModal("storyModal");
    showToast("Story shared ✦");
  } catch (error) {
    showToast(error.message, "error");
  }
}

// ============================================================
// PEOPLE / FOLLOW / EXPLORE
// ============================================================
async function loadPeopleSuggestions() {
  const usersQuery = query(collection(db, "users"), limit(12));
  const snapshot = await getDocs(usersQuery);
  const list = $("peopleSuggestions");
  const following = currentUserProfile?.following || [];
  const others = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.id !== currentUser.uid).slice(0, 5);
  if (!others.length) { list.innerHTML = `<div class="empty-state-inline">No suggestions yet</div>`; return; }
  list.innerHTML = others.map((u) => `
    <div class="people-item">
      <div class="profile-avatar"><span>${escapeHTML(getInitial(u.name))}</span></div>
      <div><strong>${escapeHTML(u.name)}</strong><small>@${escapeHTML(u.username || "")}</small></div>
      <button class="follow-btn ${following.includes(u.id) ? "following" : ""}" data-id="${u.id}" type="button">${following.includes(u.id) ? "Following" : "Follow"}</button>
    </div>`).join("");
  qsa(".follow-btn", list).forEach((btn) => btn.addEventListener("click", () => toggleFollow(btn.dataset.id, btn)));
}

async function toggleFollow(targetUid, btn) {
  const isFollowing = currentUserProfile?.following?.includes(targetUid);
  const meRef = doc(db, "users", currentUser.uid);
  const themRef = doc(db, "users", targetUid);
  await updateDoc(meRef, { following: isFollowing ? arrayRemove(targetUid) : arrayUnion(targetUid) });
  await updateDoc(themRef, { followers: isFollowing ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) });
  await loadCurrentUserProfile();
  if (btn) { btn.classList.toggle("following"); btn.textContent = isFollowing ? "Follow" : "Following"; }
  if (!isFollowing) createNotification(targetUid, "follow", `${currentUserProfile?.name || "Someone"} started following you`);
  showToast(isFollowing ? "Unfollowed" : "Now following");
}

async function runGlobalSearch(term) {
  const usersSnap = await getDocs(query(collection(db, "users"), limit(30)));
  const matches = usersSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => u.id !== currentUser.uid && (u.name?.toLowerCase().includes(term.toLowerCase()) || u.username?.toLowerCase().includes(term.toLowerCase())))
    .slice(0, 6);
  const box = $("searchResults");
  if (!matches.length) { box.innerHTML = `<div class="empty-state-inline">No matches for "${escapeHTML(term)}"</div>`; box.classList.remove("hidden"); return; }
  box.innerHTML = matches.map((u) => `
    <button class="search-result-item" type="button" data-id="${u.id}">
      <div class="profile-avatar"><span>${escapeHTML(getInitial(u.name))}</span></div>
      <div><strong>${escapeHTML(u.name)}</strong><small>@${escapeHTML(u.username || "")}</small></div>
    </button>`).join("");
  box.classList.remove("hidden");
  qsa(".search-result-item", box).forEach((btn) => btn.addEventListener("click", () => {
    box.classList.add("hidden");
    $("globalSearchInput").value = "";
    navigateTo("explore");
  }));
}

async function runExploreSearch(term) {
  const grid = $("exploreResults");
  const lower = term.trim().toLowerCase();

  if (!lower) {
    grid.innerHTML = `<div class="explore-placeholder"><span>✦</span><h3>Discover your next connection</h3><p>Search NEXORA to begin exploring.</p></div>`;
    return;
  }

  let results = [];

  if (activeCategory === "all" || activeCategory === "people") {
    const usersSnap = await getDocs(query(collection(db, "users"), limit(50)));
    usersSnap.docs.forEach((d) => {
      const u = d.data();
      if (d.id !== currentUser.uid && (u.name?.toLowerCase().includes(lower) || u.username?.toLowerCase().includes(lower))) {
        results.push({ type: "person", id: d.id, title: u.name, subtitle: "@" + (u.username || "") });
      }
    });
  }
  if (activeCategory === "all" || activeCategory === "posts") {
    const postsSnap = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50)));
    postsSnap.docs.forEach((d) => {
      const p = d.data();
      if (p.text?.toLowerCase().includes(lower)) {
        results.push({ type: "post", id: d.id, title: p.authorName, subtitle: p.text.slice(0, 60) });
      }
    });
  }
  if (activeCategory === "all" || activeCategory === "communities") {
    const communitiesSnap = await getDocs(query(collection(db, "communities"), limit(50)));
    communitiesSnap.docs.forEach((d) => {
      const c = d.data();
      if (c.name?.toLowerCase().includes(lower)) {
        results.push({ type: "community", id: d.id, title: c.name, subtitle: c.description?.slice(0, 60) || "" });
      }
    });
  }

  if (!results.length) {
    grid.innerHTML = `<div class="explore-placeholder"><span>◎</span><h3>No results</h3><p>Try a different search term.</p></div>`;
    return;
  }

  grid.innerHTML = results.map((r) => `
    <div class="explore-item">
      <div class="profile-avatar"><span>${escapeHTML(getInitial(r.title))}</span></div>
      <div><strong>${escapeHTML(r.title || "")}</strong><small>${escapeHTML(r.subtitle || "")}</small></div>
    </div>`).join("");
}

// ============================================================
// COMMUNITIES
// ============================================================
async function createCommunity() {
  const name = $("communityNameInput").value.trim();
  const description = $("communityDescriptionInput").value.trim();
  const visibility = $("communityVisibilityInput").value;
  if (!name) { showToast("Community name is required", "error"); return; }
  try {
    await addDoc(collection(db, "communities"), {
      name, description, visibility,
      ownerId: currentUser.uid,
      members: [currentUser.uid],
      membersCount: 1,
      createdAt: serverTimestamp()
    });
    $("communityNameInput").value = "";
    $("communityDescriptionInput").value = "";
    hideModal("communityModal");
    showToast("Community created ✦");
    navigateTo("communities");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function subscribeCommunities() {
  stopListener("communities");
  const communitiesQuery = query(collection(db, "communities"), orderBy("createdAt", "desc"), limit(30));
  unsub.communities = onSnapshot(communitiesQuery, (snapshot) => {
    const grid = $("communityGrid");
    if (snapshot.empty) {
      grid.innerHTML = `<div class="empty-grid"><div class="empty-icon">◫</div><h3>Communities are ready</h3><p>Create one or discover public spaces.</p></div>`;
      return;
    }
    grid.innerHTML = snapshot.docs.map((d) => {
      const c = d.data();
      const joined = c.members?.includes(currentUser.uid);
      return `
        <div class="community-card">
          <h3>${escapeHTML(c.name)}</h3>
          <p>${escapeHTML(c.description || "No description yet.")}</p>
          <div class="meta">
            <small>${c.membersCount || c.members?.length || 0} members · ${c.visibility === "private" ? "Private" : "Public"}</small>
            <button class="join-btn ${joined ? "joined" : ""}" data-id="${d.id}" type="button">${joined ? "Joined" : "Join"}</button>
          </div>
        </div>`;
    }).join("");
    qsa(".join-btn", grid).forEach((btn) => btn.addEventListener("click", () => toggleCommunityMembership(btn.dataset.id, btn)));
  }, (error) => console.error("communities error", error));
}

async function toggleCommunityMembership(communityId, btn) {
  const communityRef = doc(db, "communities", communityId);
  const snap = await getDoc(communityRef);
  const c = snap.data();
  const joined = c.members?.includes(currentUser.uid);
  await updateDoc(communityRef, {
    members: joined ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
    membersCount: increment(joined ? -1 : 1)
  });
  showToast(joined ? "Left community" : "Joined community");
}

// ============================================================
// MESSAGES / CHAT
// ============================================================
function openNewChatModal() {
  $("newChatSearchInput").value = "";
  $("newChatUserResults").innerHTML = `<div class="empty-state-inline">Search for a NEXORA user.</div>`;
  showModal("newChatModal");
}

async function searchUsersForModal(term, containerId, onSelect) {
  const container = $(containerId);
  const lower = term.trim().toLowerCase();
  if (!lower) { container.innerHTML = `<div class="empty-state-inline">Search for a NEXORA user.</div>`; return; }
  const usersSnap = await getDocs(query(collection(db, "users"), limit(50)));
  const matches = usersSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => u.id !== currentUser.uid && (u.name?.toLowerCase().includes(lower) || u.username?.toLowerCase().includes(lower)))
    .slice(0, 10);
  if (!matches.length) { container.innerHTML = `<div class="empty-state-inline">No users found.</div>`; return; }
  container.innerHTML = matches.map((u) => `
    <button class="modal-result-item" type="button" data-id="${u.id}" data-name="${escapeHTML(u.name)}">
      <div class="profile-avatar"><span>${escapeHTML(getInitial(u.name))}</span></div>
      <div><strong>${escapeHTML(u.name)}</strong><small>@${escapeHTML(u.username || "")}</small></div>
    </button>`).join("");
  qsa(".modal-result-item", container).forEach((btn) => btn.addEventListener("click", () => onSelect(btn.dataset.id, btn.dataset.name)));
}

async function startChatWithUser(otherUid, otherName) {
  const chatsQuery = query(collection(db, "chats"), where("participants", "array-contains", currentUser.uid));
  const snapshot = await getDocs(chatsQuery);
  let chatId = null;
  snapshot.docs.forEach((d) => {
    const data = d.data();
    if (data.participants.includes(otherUid)) chatId = d.id;
  });
  if (!chatId) {
    const newChat = await addDoc(collection(db, "chats"), {
      participants: [currentUser.uid, otherUid],
      participantNames: { [currentUser.uid]: currentUserProfile?.name || "You", [otherUid]: otherName },
      lastMessage: "", lastMessageAt: serverTimestamp()
    });
    chatId = newChat.id;
  }
  hideModal("newChatModal");
  openChat(chatId, otherName);
}

function subscribeChats() {
  stopListener("chats");
  const chatsQuery = query(collection(db, "chats"), where("participants", "array-contains", currentUser.uid), orderBy("lastMessageAt", "desc"));
  unsub.chats = onSnapshot(chatsQuery, (snapshot) => {
    const list = $("chatList");
    if (snapshot.empty) {
      list.innerHTML = `<div class="empty-chat-list"><span>✉</span><p>No conversations yet.</p></div>`;
      return;
    }
    list.innerHTML = snapshot.docs.map((d) => {
      const c = d.data();
      const otherUid = c.participants.find((p) => p !== currentUser.uid);
      const otherName = c.participantNames?.[otherUid] || "NEXORA User";
      return `
        <button class="chat-list-item ${activeChatId === d.id ? "active" : ""}" type="button" data-id="${d.id}" data-name="${escapeHTML(otherName)}">
          <div class="profile-avatar"><span>${escapeHTML(getInitial(otherName))}</span></div>
          <div><strong>${escapeHTML(otherName)}</strong><p>${escapeHTML(c.lastMessage || "Say hello 👋")}</p></div>
        </button>`;
    }).join("");
    qsa(".chat-list-item", list).forEach((btn) => btn.addEventListener("click", () => openChat(btn.dataset.id, btn.dataset.name)));
  }, (error) => console.error("chats error", error));
}

function filterChatList(term) {
  const lower = term.trim().toLowerCase();
  qsa(".chat-list-item").forEach((item) => {
    const name = item.querySelector("strong").textContent.toLowerCase();
    item.style.display = name.includes(lower) ? "" : "none";
  });
}

function openChat(chatId, otherName) {
  activeChatId = chatId;
  activeChatUser = otherName;
  $("chatEmptyState").classList.add("hidden");
  $("activeChatArea").classList.remove("hidden");
  $("activeChatInitial").textContent = getInitial(otherName);
  $("activeChatName").textContent = otherName;
  $("activeChatStatus").textContent = "Active now";

  stopListener("messages");
  const messagesQuery = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"), limit(200));
  unsub.messages = onSnapshot(messagesQuery, (snapshot) => {
    const list = $("messageList");
    list.innerHTML = snapshot.docs.map((d) => {
      const m = d.data();
      const mine = m.senderId === currentUser.uid;
      return `<div class="msg-bubble ${mine ? "me" : ""}">${escapeHTML(m.text)}<time>${formatTime(m.createdAt)}</time></div>`;
    }).join("");
    list.scrollTop = list.scrollHeight;
  }, (error) => console.error("messages error", error));
}

async function sendMessage(e) {
  e.preventDefault();
  const input = $("messageInput");
  const text = input.value.trim();
  if (!text || !activeChatId) return;
  input.value = "";
  await addDoc(collection(db, "chats", activeChatId, "messages"), {
    senderId: currentUser.uid, text, createdAt: serverTimestamp()
  });
  await updateDoc(doc(db, "chats", activeChatId), { lastMessage: text, lastMessageAt: serverTimestamp() });
}

// ============================================================
// CALLS
// ============================================================
function openCallModal(type) {
  $("callModalTitle").textContent = type === "video" ? "Start a video call" : type === "room" ? "Create a room" : "Start a voice call";
  $("callUserList").innerHTML = `<div class="empty-state-inline">Loading contacts…</div>`;
  showModal("callModal");
  getDocs(query(collection(db, "users"), limit(20))).then((snap) => {
    const others = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.id !== currentUser.uid);
    if (!others.length) { $("callUserList").innerHTML = `<div class="empty-state-inline">No contacts yet.</div>`; return; }
    $("callUserList").innerHTML = others.map((u) => `
      <button class="modal-result-item" type="button" data-id="${u.id}" data-name="${escapeHTML(u.name)}">
        <div class="profile-avatar"><span>${escapeHTML(getInitial(u.name))}</span></div>
        <div><strong>${escapeHTML(u.name)}</strong><small>@${escapeHTML(u.username || "")}</small></div>
      </button>`).join("");
    qsa(".modal-result-item", $("callUserList")).forEach((btn) => btn.addEventListener("click", async () => {
      await logCall(type, btn.dataset.id, btn.dataset.name);
      hideModal("callModal");
    }));
  });
}

async function logCall(type, withUid, withName) {
  await addDoc(collection(db, "calls"), {
    uid: currentUser.uid, withUid, withName: withName || activeChatUser || "NEXORA User",
    type, createdAt: serverTimestamp()
  });
  showToast(`${type === "video" ? "Video" : "Voice"} calling isn't fully wired up yet — logged to your call history.`);
}

function logCallAndNotify(type) {
  if (!activeChatId || !activeChatUser) { showToast("Open a chat first", "error"); return; }
  const otherUid = activeChatUser; // display name only in this simplified flow
  logCall(type, null, activeChatUser);
}

function subscribeCallHistory() {
  stopListener("calls");
  const callsQuery = query(collection(db, "calls"), where("uid", "==", currentUser.uid), orderBy("createdAt", "desc"), limit(30));
  unsub.calls = onSnapshot(callsQuery, (snapshot) => {
    const list = $("callHistoryList");
    if (snapshot.empty) { list.innerHTML = `<div class="empty-state-inline">No calls yet.</div>`; return; }
    list.innerHTML = snapshot.docs.map((d) => {
      const c = d.data();
      return `
        <div class="call-history-item">
          <div class="profile-avatar"><span>${escapeHTML(getInitial(c.withName))}</span></div>
          <div><strong>${escapeHTML(c.withName || "NEXORA User")}</strong><small>${c.type === "video" ? "Video call" : "Voice call"} · ${formatTime(c.createdAt)}</small></div>
        </div>`;
    }).join("");
  }, (error) => console.error("calls error", error));
}

// ============================================================
// BOOKMARKS
// ============================================================
function subscribeBookmarks() {
  stopListener("bookmarks");
  const bookmarksQuery = query(collection(db, "users", currentUser.uid, "bookmarks"), orderBy("savedAt", "desc"));
  unsub.bookmarks = onSnapshot(bookmarksQuery, (snapshot) => {
    const list = $("savedList");
    if (snapshot.empty) {
      list.innerHTML = `<div class="empty-grid"><div class="empty-icon">♧</div><h3>Nothing saved yet</h3><p>Save a post and it will appear here.</p></div>`;
      return;
    }
    list.innerHTML = snapshot.docs.map((d) => {
      const p = d.data();
      return `
        <article class="post-card">
          <div class="post-head">
            <div class="post-author">
              <div class="profile-avatar"><span>${escapeHTML(getInitial(p.authorName))}</span></div>
              <div><strong>${escapeHTML(p.authorName || "NEXORA User")}</strong><small>Saved ${formatTime(p.savedAt)}</small></div>
            </div>
            <button class="more-btn unsave-btn" data-id="${d.id}" type="button">✕</button>
          </div>
          ${p.text ? `<p class="post-text">${escapeHTML(p.text)}</p>` : ""}
          ${p.mediaURL ? `<div class="post-media">${p.mediaType === "video" ? `<video src="${p.mediaURL}" controls></video>` : `<img src="${p.mediaURL}" alt="saved media">`}</div>` : ""}
        </article>`;
    }).join("");
    qsa(".unsave-btn", list).forEach((btn) => btn.addEventListener("click", async () => {
      await deleteDoc(doc(db, "users", currentUser.uid, "bookmarks", btn.dataset.id));
      showToast("Removed from saved");
    }));
  }, (error) => console.error("bookmarks error", error));
}

// ============================================================
// PROFILE
// ============================================================
async function loadProfileView() {
  await loadCurrentUserProfile();
  const p = currentUserProfile || {};
  $("profileInitial").textContent = getInitial(p.name);
  $("profileName").textContent = p.name || "NEXORA User";
  $("profileHandle").textContent = "@" + (p.username || "nexora");
  $("profileBio").textContent = p.bio || "Building connections beyond boundaries.";
  $("profileLocation").textContent = "⌖ " + (p.location || "Not set");
  $("profileWebsite").textContent = "⌁ " + (p.website || "Not set");
  $("profileJoined").textContent = "◷ Joined " + (p.createdAt ? formatTime(p.createdAt) : "recently");
  $("postCount").textContent = p.postCount || 0;
  $("followerCount").textContent = p.followers?.length || 0;
  $("followingCount").textContent = p.following?.length || 0;

  stopListener("myPosts");
  const myPostsQuery = query(collection(db, "posts"), where("uid", "==", currentUser.uid), orderBy("createdAt", "desc"), limit(30));
  unsub.myPosts = onSnapshot(myPostsQuery, (snapshot) => {
    const container = $("profilePosts");
    if (snapshot.empty) {
      container.innerHTML = `<div class="empty-grid"><div class="empty-icon">✦</div><h3>Share your first post</h3><button id="profileCreatePostBtn" class="primary-btn" type="button">Create post</button></div>`;
      $("profileCreatePostBtn").onclick = openPostModal;
      return;
    }
    currentFeedDocs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    container.innerHTML = currentFeedDocs.map((post) => {
      const liked = post.likes?.includes(currentUser.uid);
      return `
        <article class="post-card" data-post-id="${post.id}">
          <div class="post-head">
            <div class="post-author">
              <div class="profile-avatar"><span>${escapeHTML(getInitial(post.authorName))}</span></div>
              <div><strong>${escapeHTML(post.authorName)}</strong><small>${formatTime(post.createdAt)}</small></div>
            </div>
          </div>
          ${post.text ? `<p class="post-text">${escapeHTML(post.text)}</p>` : ""}
          ${post.mediaURL ? `<div class="post-media">${post.mediaType === "video" ? `<video src="${post.mediaURL}" controls></video>` : `<img src="${post.mediaURL}" alt="post media">`}</div>` : ""}
          <div class="post-actions">
            <button class="action-btn like-btn ${liked ? "liked" : ""}" data-id="${post.id}" type="button">${liked ? "♥" : "♡"} Like${post.likes?.length ? " · " + post.likes.length : ""}</button>
          </div>
        </article>`;
    }).join("");
    qsa(".like-btn", container).forEach((btn) => btn.addEventListener("click", () => toggleLike(btn.dataset.id)));
  }, (error) => console.error("my posts error", error));
}

function openEditProfileModal() {
  const p = currentUserProfile || {};
  $("editProfileName").value = p.name || "";
  $("editProfileBio").value = p.bio || "";
  $("editProfileLocation").value = p.location || "";
  $("editProfileWebsite").value = p.website || "";
  showModal("editProfileModal");
}

async function saveProfileChanges() {
  const name = $("editProfileName").value.trim();
  const bio = $("editProfileBio").value.trim();
  const location = $("editProfileLocation").value.trim();
  const website = $("editProfileWebsite").value.trim();
  try {
    await updateDoc(doc(db, "users", currentUser.uid), { name, bio, location, website });
    if (name && name !== currentUser.displayName) await updateProfile(currentUser, { displayName: name });
    await loadCurrentUserProfile();
    hydrateTopbarAndSidebar();
    hideModal("editProfileModal");
    showToast("Profile updated");
    if (activeRoute === "profile") loadProfileView();
  } catch (error) {
    showToast(error.message, "error");
  }
}

// ============================================================
// SETTINGS
// ============================================================
function loadSettingsView() {
  $("settingsEmail").textContent = currentUser.email || "";
  $("publicProfileToggle").checked = currentUserProfile?.isPublic !== false;
  $("messageNotificationsToggle").checked = currentUserProfile?.notifyMessages !== false;
}

// ============================================================
// NOTIFICATIONS
// ============================================================
async function createNotification(targetUid, type, text) {
  if (!targetUid || targetUid === currentUser.uid) return;
  await addDoc(collection(db, "users", targetUid, "notifications"), {
    type, text, read: false, createdAt: serverTimestamp()
  });
}

function subscribeNotifications() {
  stopListener("notifications");
  const notifQuery = query(collection(db, "users", currentUser.uid, "notifications"), orderBy("createdAt", "desc"), limit(30));
  unsub.notifications = onSnapshot(notifQuery, (snapshot) => {
    const list = $("notificationsList");
    const unreadCount = snapshot.docs.filter((d) => !d.data().read).length;
    $("notificationBadge").textContent = unreadCount;
    $("notificationBadge").classList.toggle("hidden", unreadCount === 0);
    if (snapshot.empty) { list.innerHTML = `<div class="empty-state-inline">You're all caught up.</div>`; return; }
    list.innerHTML = snapshot.docs.map((d) => {
      const n = d.data();
      return `<div class="notification-item ${n.read ? "" : "unread"}"><p>${escapeHTML(n.text)}</p><small>${formatTime(n.createdAt)}</small></div>`;
    }).join("");
  }, (error) => console.error("notifications error", error));
}

async function markAllNotificationsRead() {
  const notifSnap = await getDocs(collection(db, "users", currentUser.uid, "notifications"));
  await Promise.all(notifSnap.docs.map((d) => updateDoc(d.ref, { read: true })));
  showToast("All notifications marked as read");
}

// kick off notifications listener once main app is bound
const originalBind = bindMainAppEvents;
bindMainAppEvents = function () {
  const wasBound = mainAppBound;
  originalBind();
  if (!wasBound) subscribeNotifications();
};
