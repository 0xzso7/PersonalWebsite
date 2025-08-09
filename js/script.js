AOS.init({
    duration: 700,
    once: true,
    easing: 'ease-in-out'
});

const splide = new Splide('#image-carousel', {
    type: 'loop',
    perPage: 2,
    perMove: 1,
    autoplay: true,
    interval: 4000,
    speed: 800,
    gap: '1rem',
    pagination: false,
    arrows: false,
    drag: true,
    keyboard: true,
    focus: 'center',
    trimSpace: false,
    lazyLoad: 'nearby',
    breakpoints: {
        640: { pagination: true },
        480: { gap: '0.5rem' }
    }
}).mount();

// Navigation
document.getElementById('prev-btn').addEventListener('click', () => splide.go('<'));
document.getElementById('next-btn').addEventListener('click', () => splide.go('>'));

// Modal logic
const modal = document.getElementById('portfolio-modal');
const modalImage = document.getElementById('modal-image');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-description');
const closeModal = document.querySelector('.close-btn');
const githubLink = document.getElementById('github-link');

function openModalFromSlide(slide) {
    modalImage.src = slide.querySelector('img').src;
    modalTitle.textContent = slide.dataset.title;
    modalDesc.textContent = slide.dataset.description;
    githubLink.href = slide.dataset.github || '#';
    modal.classList.remove('hidden');
}

// View More button
document.getElementById('view-more-btn').addEventListener('click', () => {
    const currentSlide = splide.Components.Slides.getAt(splide.index).slide;
    openModalFromSlide(currentSlide);
});

// Clickable slides
document.querySelectorAll('.splide__slide').forEach(slide => {
    slide.addEventListener('click', () => {
        openModalFromSlide(slide);
    });
});

// Close modal
closeModal.addEventListener('click', () => modal.classList.add('hidden'));
window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.add('hidden');
    }
});

//auto adjust textarea
document.addEventListener('input', function (event) {
    if (event.target.tagName.toLowerCase() === 'textarea') {
        const textarea = event.target;
        textarea.style.height = 'auto'; // reset height
        textarea.style.height = textarea.scrollHeight + 'px'; // adjust to fit
    }
});

// Back to Top Button Logic
const backToTopBtn = document.querySelector('.back-to-top');
const footer = document.querySelector('footer');

function checkFooterVisibility() {
    const footerRect = footer.getBoundingClientRect();
    const footerVisible = footerRect.top <= window.innerHeight;

    if (footerVisible) {
        backToTopBtn.classList.add('visible');
    } else {
        backToTopBtn.classList.remove('visible');
    }
}

// Run on scroll and initial load
window.addEventListener('scroll', checkFooterVisibility);
window.addEventListener('load', checkFooterVisibility);