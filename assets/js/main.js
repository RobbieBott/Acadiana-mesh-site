// Mobile nav toggle
document.addEventListener('DOMContentLoaded', function() {
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');

  if (toggle && links) {
    toggle.addEventListener('click', function() {
      links.classList.toggle('open');
    });

    // Close nav when a link is clicked
    links.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', function() {
        links.classList.remove('open');
      });
    });
  }
});