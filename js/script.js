// ===== MOBILE MENU =====
const navMenu = document.getElementById('nav-menu');
const navToggle = document.getElementById('nav-toggle');
const navClose = document.getElementById('nav-close');

// Show menu
if (navToggle) {
    navToggle.addEventListener('click', () => {
        navMenu.classList.add('show-menu');
    });
}

// Hide menu
if (navClose) {
    navClose.addEventListener('click', () => {
        navMenu.classList.remove('show-menu');
    });
}

// Close menu when clicking nav links
const navLinks = document.querySelectorAll('.nav__link');
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('show-menu');
    });
});

// ===== HEADER SCROLL =====
function scrollHeader() {
    const header = document.getElementById('header');
    if (window.scrollY >= 80) {
        header.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
    } else {
        header.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
    }
}
window.addEventListener('scroll', scrollHeader);

// ===== FAQ ACCORDION =====
const faqItems = document.querySelectorAll('.faq__item');

faqItems.forEach(item => {
    const question = item.querySelector('.faq__question');
    
    question.addEventListener('click', () => {
        // Close other items
        faqItems.forEach(otherItem => {
            if (otherItem !== item) {
                otherItem.classList.remove('active');
            }
        });
        
        // Toggle current item
        item.classList.toggle('active');
    });
});

// ===== SMOOTH SCROLL =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const headerOffset = 80;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// ===== FORM SUBMISSION =====
const waitlistForm = document.getElementById('waitlist-form');

if (waitlistForm) {
    waitlistForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = waitlistForm.querySelector('input[type="email"]').value;
        
        // Here you would typically send the email to your backend
        console.log('Email submitted:', email);
        
        // Track conversion with Google Analytics
        if (typeof gtag !== 'undefined') {
            gtag('event', 'conversion', {
                send_to: 'G-7KK7VYDR9D',
                event_category: 'Form',
                event_label: 'Waitlist Signup',
                value: 1
            });
            
            // Track as custom event
            gtag('event', 'waitlist_signup', {
                event_category: 'Conversion',
                event_label: 'Email Signup',
                value: 1
            });
        }
        
        // Show success message
        alert('Thank you for joining our waitlist! We\'ll be in touch soon.');
        waitlistForm.reset();
        
        // In production, you would integrate with your email service or backend:
        // fetch('/api/waitlist', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ email })
        // });
    });
}

// ===== SCROLL REVEAL ANIMATION =====
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for scroll animation
document.addEventListener('DOMContentLoaded', () => {
    const animateElements = document.querySelectorAll('.feature-card, .faq__item, .shopify__data, .shopify__image');
    
    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// ===== NAVBAR ACTIVE LINK =====
const sections = document.querySelectorAll('section[id]');

function scrollActive() {
    const scrollY = window.pageYOffset;

    sections.forEach(current => {
        const sectionHeight = current.offsetHeight;
        const sectionTop = current.offsetTop - 100;
        const sectionId = current.getAttribute('id');
        const link = document.querySelector(`.nav__link[href*="${sectionId}"]`);

        if (link) {
            if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                link.style.color = 'var(--primary-color)';
            } else {
                link.style.color = 'var(--text-secondary)';
            }
        }
    });
}

window.addEventListener('scroll', scrollActive);

// ===== GOOGLE ANALYTICS TRACKING =====
// Track page view (automatically tracked by gtag)
console.log('Page viewed: Landing Page');

// Track button clicks
document.querySelectorAll('.button').forEach(button => {
    button.addEventListener('click', (e) => {
        const buttonText = button.textContent.trim();
        const buttonHref = button.getAttribute('href');
        
        console.log('Button clicked:', buttonText);
        
        // Track button clicks with Google Analytics
        if (typeof gtag !== 'undefined') {
            gtag('event', 'click', {
                event_category: 'Button',
                event_label: buttonText,
                value: 1
            });
        }
    });
});

// Track navigation clicks
document.querySelectorAll('.nav__link').forEach(link => {
    link.addEventListener('click', (e) => {
        const linkText = link.textContent.trim();
        
        if (typeof gtag !== 'undefined') {
            gtag('event', 'click', {
                event_category: 'Navigation',
                event_label: linkText,
                value: 1
            });
        }
    });
});

// Track FAQ interactions
document.querySelectorAll('.faq__question').forEach(question => {
    question.addEventListener('click', (e) => {
        const faqText = question.querySelector('h3').textContent.trim();
        
        if (typeof gtag !== 'undefined') {
            gtag('event', 'click', {
                event_category: 'FAQ',
                event_label: faqText,
                value: 1
            });
        }
    });
});

// Track scroll depth
let scrollDepthMarkers = [25, 50, 75, 100];
let scrollDepthTracked = [];

window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset;
    const docHeight = document.body.scrollHeight - window.innerHeight;
    const scrollPercent = Math.round((scrollTop / docHeight) * 100);
    
    scrollDepthMarkers.forEach(marker => {
        if (scrollPercent >= marker && !scrollDepthTracked.includes(marker)) {
            scrollDepthTracked.push(marker);
            
            if (typeof gtag !== 'undefined') {
                gtag('event', 'scroll', {
                    event_category: 'Engagement',
                    event_label: `${marker}%`,
                    value: marker
                });
            }
        }
    });
});

// ===== DASHBOARD CAROUSEL (DISABLED - USING STATIC IMAGE) =====
/*
document.addEventListener('DOMContentLoaded', function() {
    const carouselTrack = document.getElementById('dashboard-carousel-track');
    const prevBtn = document.getElementById('carousel-prev');
    const nextBtn = document.getElementById('carousel-next');
    const dots = document.querySelectorAll('.carousel-dot');
    const slides = document.querySelectorAll('.carousel-slide');
    
    if (!carouselTrack || !prevBtn || !nextBtn) return;
    
    let currentSlide = 0;
    const totalSlides = slides.length;
    
    function updateCarousel() {
        const translateX = -currentSlide * 33.333;
        carouselTrack.style.transform = `translateX(${translateX}%)`;
        
        // Update active states
        slides.forEach((slide, index) => {
            slide.classList.toggle('active', index === currentSlide);
        });
        
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentSlide);
        });
        
        // Update button states
        prevBtn.disabled = currentSlide === 0;
        nextBtn.disabled = currentSlide === totalSlides - 1;
        
        // Google Analytics tracking
        if (typeof gtag !== 'undefined') {
            gtag('event', 'carousel_slide_view', {
                event_category: 'Dashboard Carousel',
                event_label: `Slide ${currentSlide + 1}`,
                value: currentSlide + 1
            });
        }
    }
    
    function nextSlide() {
        if (currentSlide < totalSlides - 1) {
            currentSlide++;
            updateCarousel();
        }
    }
    
    function prevSlide() {
        if (currentSlide > 0) {
            currentSlide--;
            updateCarousel();
        }
    }
    
    function goToSlide(slideIndex) {
        if (slideIndex >= 0 && slideIndex < totalSlides) {
            currentSlide = slideIndex;
            updateCarousel();
        }
    }
    
    // Event listeners
    nextBtn.addEventListener('click', nextSlide);
    prevBtn.addEventListener('click', prevSlide);
    
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => goToSlide(index));
    });
    
    // Auto-play carousel (optional)
    let autoPlayInterval;
    
    function startAutoPlay() {
        autoPlayInterval = setInterval(() => {
            if (currentSlide < totalSlides - 1) {
                currentSlide++;
            } else {
                currentSlide = 0;
            }
            updateCarousel();
        }, 5000); // Change slide every 5 seconds
    }
    
    function stopAutoPlay() {
        clearInterval(autoPlayInterval);
    }
    
    // Start auto-play
    startAutoPlay();
    
    // Pause auto-play on hover
    const carousel = document.querySelector('.dashboard-carousel');
    if (carousel) {
        carousel.addEventListener('mouseenter', stopAutoPlay);
        carousel.addEventListener('mouseleave', startAutoPlay);
    }
    
    // Initialize
    updateCarousel();
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') prevSlide();
        if (e.key === 'ArrowRight') nextSlide();
    });
});
*/

// ===== PERFORMANCE OPTIMIZATION =====
// Lazy load images (if you add images later)
if ('loading' in HTMLImageElement.prototype) {
    const images = document.querySelectorAll('img[loading="lazy"]');
    images.forEach(img => {
        img.src = img.dataset.src;
    });
} else {
    // Fallback for browsers that don't support lazy loading
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lazysizes/5.3.2/lazysizes.min.js';
    document.body.appendChild(script);
}

