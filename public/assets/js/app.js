// Header Sticky
document.addEventListener('scroll', function () {
  const header = document.getElementById('main-header');
  if (window.scrollY > 30) {
    header.classList.add('backdrop-blur-md', 'bg-white/70', 'dark:bg-slate-800/70', 'shadow-sm');
  } else {
    header.classList.remove('backdrop-blur-md', 'bg-white/70', 'dark:bg-slate-800/70', 'shadow-sm');
  }
});
	
// Nav Link
const links = Array.from(document.querySelectorAll(".nav-link"));
const currentPath = window.location.pathname;

function normalizePath(path) {
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path;
}

function isMatch(href, currentPath) {
  href = normalizePath(href);
  currentPath = normalizePath(currentPath);
  return currentPath === href || currentPath.startsWith(href + "/");
}

const normalizedCurrentPath = normalizePath(currentPath);

const matchedLinks = links.filter(link => {
  const href = link.getAttribute("href");
  return isMatch(href, normalizedCurrentPath);
});

let maxLength = -1;
let activeHref = null;

matchedLinks.forEach(link => {
  const href = normalizePath(link.getAttribute("href"));
  if (href.length > maxLength) {
    maxLength = href.length;
    activeHref = href;
  }
});

links.forEach(link => {
  const href = normalizePath(link.getAttribute("href"));
  if (href === activeHref) {
    link.classList.add("text-blue-500", "font-semibold");
  } else {
    link.classList.remove("text-blue-500", "font-semibold");
  }
});

// Dark Mode
const toggleBtn = document.getElementById("toggleDark");
const htmlEl = document.documentElement;
const iconSun = document.getElementById("iconSun");
const iconMoon = document.getElementById("iconMoon");

function updateIcon() {
  if (!iconSun || !iconMoon) return;

  if (htmlEl.classList.contains("dark")) {
    iconSun.classList.add("hidden");
    iconMoon.classList.remove("hidden");
  } else {
    iconSun.classList.remove("hidden");
    iconMoon.classList.add("hidden");
  }
}

if (localStorage.getItem("darkMode") === "true") {
  htmlEl.classList.add("dark");
}
updateIcon();

if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    htmlEl.classList.toggle("dark");
    localStorage.setItem("darkMode", htmlEl.classList.contains("dark"));
    updateIcon();
  });
}

// Dropdown
const dropdowns = document.querySelectorAll('.dropdown');

dropdowns.forEach(drop => {
  const btn = drop.querySelector('.dropdown-btn');
  const menu = drop.querySelector('.dropdown-menu');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();

    dropdowns.forEach(d => {
      if (d !== drop) {
        const m = d.querySelector('.dropdown-menu');
        m.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
        m.classList.remove('opacity-100', 'scale-100', 'pointer-events-auto');
      }
    });

    if (menu.classList.contains('opacity-0')) {
      menu.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
      menu.classList.add('opacity-100', 'scale-100', 'pointer-events-auto');
    } else {
      menu.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
      menu.classList.remove('opacity-100', 'scale-100', 'pointer-events-auto');
    }
  });
});

window.addEventListener('click', () => {
  dropdowns.forEach(drop => {
    const menu = drop.querySelector('.dropdown-menu');
    menu.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
    menu.classList.remove('opacity-100', 'scale-100', 'pointer-events-auto');
  });
});