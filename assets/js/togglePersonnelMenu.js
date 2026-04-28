function togglePersonnelMenu() {
  const menu = document.getElementById("personnel-submenu");
  const chevron = document.getElementById("personnel-chevron");
  const btn = document.getElementById("nav-personnel-btn");
  const isOpen = menu.style.maxHeight && menu.style.maxHeight !== "0px";
  menu.style.maxHeight = isOpen ? "0px" : "200px";
  chevron.style.transform = isOpen ? "" : "rotate(90deg)";
  btn.classList.toggle("active", !isOpen);
}
