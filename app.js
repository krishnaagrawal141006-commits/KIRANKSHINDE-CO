document.addEventListener('DOMContentLoaded', () => {


  // 2. Scroll Progress Bar
  const progressBar = document.createElement('div');
  progressBar.className = 'scroll-progress-bar';
  document.body.appendChild(progressBar);

  window.addEventListener('scroll', () => {
    const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = (winScroll / height) * 100;
    progressBar.style.width = scrolled + '%';
  });

  // 3. Custom Interactive Cursor & Follower (Desktop only)
  if (window.innerWidth > 992) {
    const cursorDot = document.createElement('div');
    const cursorFollower = document.createElement('div');
    cursorDot.className = 'custom-cursor';
    cursorFollower.className = 'custom-cursor-follower';
    document.body.appendChild(cursorDot);
    document.body.appendChild(cursorFollower);

    let mouseX = 0, mouseY = 0;
    let followerX = 0, followerY = 0;

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      cursorDot.style.left = `${mouseX}px`;
      cursorDot.style.top = `${mouseY}px`;
    });

    function renderCursor() {
      followerX += (mouseX - followerX) * 0.18;
      followerY += (mouseY - followerY) * 0.18;
      cursorFollower.style.left = `${followerX}px`;
      cursorFollower.style.top = `${followerY}px`;
      requestAnimationFrame(renderCursor);
    }
    renderCursor();

    const interactiveTargets = document.querySelectorAll('a, button, .service-card, .review-card, .faq-question, .market-card');
    interactiveTargets.forEach(el => {
      el.addEventListener('mouseenter', () => {
        cursorDot.classList.add('active');
        cursorFollower.classList.add('active');
      });
      el.addEventListener('mouseleave', () => {
        cursorDot.classList.remove('active');
        cursorFollower.classList.remove('active');
      });
    });
  }

  // 4. Dynamic Interactive Canvas: Financial Ledger Matrix & Accounts Motion
  const heroCanvas = document.getElementById('heroCanvas');
  if (heroCanvas) {
    const ctx = heroCanvas.getContext('2d');
    let width = (heroCanvas.width = heroCanvas.offsetWidth);
    let height = (heroCanvas.height = heroCanvas.offsetHeight);

    window.addEventListener('resize', () => {
      if (!heroCanvas) return;
      width = heroCanvas.width = heroCanvas.offsetWidth;
      height = heroCanvas.height = heroCanvas.offsetHeight;
    });

    const particles = [];
    const particleCount = window.innerWidth < 768 ? 22 : 45;
    const acctGlyphs = ['₹', '%', '∑', 'GST', 'ITR', 'FCA', '44AB'];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2 + 1.2,
        isGlyph: Math.random() > 0.65,
        glyph: acctGlyphs[Math.floor(Math.random() * acctGlyphs.length)],
        opacity: Math.random() * 0.35 + 0.15
      });
    }

    function animateParticles() {
      ctx.clearRect(0, 0, width, height);

      // Draw subtle ledger coordinate grid lines
      ctx.strokeStyle = 'rgba(17, 34, 51, 0.025)';
      ctx.lineWidth = 1;
      const step = 80;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Connecting lines between close financial nodes
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 125) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(194, 146, 39, ${0.18 * (1 - dist / 125)})`;
            ctx.lineWidth = 0.9;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Render nodes & floating accounting glyphs
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        if (p.isGlyph) {
          ctx.font = '600 13px Outfit, sans-serif';
          ctx.fillStyle = `rgba(194, 146, 39, ${p.opacity})`;
          ctx.fillText(p.glyph, p.x, p.y);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(27, 56, 88, 0.35)';
          ctx.fill();
        }
      });

      requestAnimationFrame(animateParticles);
    }
    animateParticles();
  }

  // 5. 3D Tilt Card Physics on Hover (Desktop)
  if (window.innerWidth > 992) {
    const tiltCards = document.querySelectorAll('.tilt-card');
    tiltCards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -7;
        const rotateY = ((x - centerX) / centerX) * 7;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
      });
    });

    const magneticBtns = document.querySelectorAll('.magnetic-btn');
    magneticBtns.forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${x * 0.22}px, ${y * 0.22}px)`;
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translate(0px, 0px)';
      });
    });
  }

  // 6. Intersection Observer for Scroll Reveal Animations
  const revealElements = document.querySelectorAll('.reveal-fade-up, .reveal-fade-left, .reveal-fade-right, .reveal-zoom-in');
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -30px 0px'
  });
  revealElements.forEach(el => revealObserver.observe(el));

  // 7. Counter Animation for Numbers
  const statNumbers = document.querySelectorAll('.stat-number');
  let counted = false;
  const countObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !counted) {
        counted = true;
        statNumbers.forEach(stat => {
          const targetText = stat.innerText.trim();
          if (targetText.includes('15+')) {
            animateValue(stat, 0, 15, 1200, '+');
          }
        });
      }
    });
  }, { threshold: 0.5 });

  const heroSection = document.querySelector('.hero');
  if (heroSection) countObserver.observe(heroSection);

  function animateValue(element, start, end, duration, suffix = '') {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      element.innerHTML = Math.floor(easeProgress * (end - start) + start) + suffix;
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        element.innerHTML = end + suffix;
      }
    };
    window.requestAnimationFrame(step);
  }

  // 8. Mobile Navigation Drawer Toggle
  const mobileToggleBtn = document.getElementById('mobileToggleBtn');
  const navMenu = document.getElementById('navMenu');

  if (mobileToggleBtn && navMenu) {
    mobileToggleBtn.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      const icon = mobileToggleBtn.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-bars');
        icon.classList.toggle('fa-xmark');
      }
    });

    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        const icon = mobileToggleBtn.querySelector('i');
        if (icon) {
          icon.classList.add('fa-bars');
          icon.classList.remove('fa-xmark');
        }
      });
    });
  }

  // 9. Sticky Navbar Shadow
  const mainNavbar = document.getElementById('mainNavbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
      mainNavbar.classList.add('scrolled');
    } else {
      mainNavbar.classList.remove('scrolled');
    }
  });

  // 10. FAQ Accordion
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question');
    if (questionBtn) {
      questionBtn.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        faqItems.forEach(otherItem => otherItem.classList.remove('active'));
        if (!isActive) {
          item.classList.add('active');
        }
      });
    }
  });

  // 11. Appointment Consultation Request to WhatsApp
  const appointmentForm = document.getElementById('appointmentForm');
  if (appointmentForm) {
    appointmentForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('clientName').value.trim();
      const phone = document.getElementById('clientPhone').value.trim();
      const businessType = document.getElementById('businessType').value;
      const service = document.getElementById('serviceSelect').value;
      const notes = document.getElementById('clientNotes').value.trim();

      if (!name || !phone) {
        alert('Please fill in your name and phone number.');
        return;
      }

      const formattedMessage = `Hello CA Kiran K. Shinde & Co.,%0A%0A*New Website Consultation Request:*%0A• *Client Name:* ${encodeURIComponent(name)}%0A• *Phone:* ${encodeURIComponent(phone)}%0A• *Entity Type:* ${encodeURIComponent(businessType)}%0A• *Service Required:* ${encodeURIComponent(service)}%0A• *Details/Requirement:* ${encodeURIComponent(notes || 'Consultation required')}%0A%0APlease let me know your available appointment slot.`;

      const whatsappUrl = `https://wa.me/917506647791?text=${formattedMessage}`;
      window.open(whatsappUrl, '_blank');

      appointmentForm.reset();
    });
  }

  // ================= 12. Parallax Scrolling Engine =================
  const parallaxElements = document.querySelectorAll('[data-parallax]');
  if (parallaxElements.length > 0) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.pageYOffset || document.documentElement.scrollTop;
          parallaxElements.forEach(el => {
            const speed = parseFloat(el.getAttribute('data-parallax')) || 0.1;
            el.style.transform = `translateY(${scrollY * speed}px)`;
          });
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  // ================= 13. Accounts Suite Tabs Switcher =================
  const acctTabs = document.querySelectorAll('.acct-tab-btn');
  const acctPanes = document.querySelectorAll('.acct-tab-pane');

  acctTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = `pane-${tab.getAttribute('data-tab')}`;
      acctTabs.forEach(t => t.classList.remove('active'));
      acctPanes.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
      }
    });
  });

  // ================= 14. Smart Income Tax & Sec 44AB Audit Calculator Engine =================
  const incomeSlider = document.getElementById('incomeSlider');
  const incomeDisplayVal = document.getElementById('incomeDisplayVal');
  const incomeLabelText = document.getElementById('incomeLabelText');
  const deductionsSlider = document.getElementById('deductionsSlider');
  const deductionsDisplayVal = document.getElementById('deductionsDisplayVal');
  const deductionsField = document.getElementById('deductionsField');
  const entityBtns = document.querySelectorAll('.entity-btn');
  const chipBtns = document.querySelectorAll('.chip-btn');

  let currentEntity = 'salaried'; // 'salaried', 'professional', 'business'

  function formatIndianRupee(num) {
    if (num >= 10000000) {
      return `₹${(num / 10000000).toFixed(2)} Crore`;
    } else if (num >= 100000) {
      return `₹${(num / 100000).toFixed(2)} Lakh`;
    }
    return `₹${Number(num).toLocaleString('en-IN')}`;
  }

  function calculateTax() {
    if (!incomeSlider) return;
    const grossVal = parseFloat(incomeSlider.value);
    const deductionsVal = deductionsSlider ? parseFloat(deductionsSlider.value) : 150000;

    // Entity-based taxable base computation
    let taxableNewBase = grossVal;
    let taxableOldBase = grossVal;
    let stdDedNew = 0;
    let stdDedOld = 0;

    if (currentEntity === 'salaried') {
      stdDedNew = 75000; // Budget 2024 increased to 75k
      stdDedOld = 50000;
      taxableNewBase = Math.max(0, grossVal - stdDedNew);
      taxableOldBase = Math.max(0, grossVal - stdDedOld - deductionsVal);
    } else if (currentEntity === 'professional') {
      // Sec 44ADA: 50% presumptive profit
      const presumptiveProfit = grossVal * 0.50;
      taxableNewBase = presumptiveProfit;
      taxableOldBase = Math.max(0, presumptiveProfit - deductionsVal);
    } else if (currentEntity === 'business') {
      // Sec 44AD: 6% digital / 8% cash turnover profit
      const presumptiveProfit = grossVal * 0.06;
      taxableNewBase = presumptiveProfit;
      taxableOldBase = Math.max(0, presumptiveProfit - deductionsVal);
    }

    // Compute New Regime Tax (Sec 115BAC)
    let taxNew = 0;
    if (taxableNewBase <= 700000) {
      taxNew = 0; // Sec 87A 100% full rebate up to 7 Lakh taxable
    } else {
      if (taxableNewBase > 1500000) taxNew += (taxableNewBase - 1500000) * 0.30;
      if (taxableNewBase > 1200000) taxNew += Math.min(taxableNewBase - 1200000, 300000) * 0.20;
      if (taxableNewBase > 1000000) taxNew += Math.min(taxableNewBase - 1000000, 200000) * 0.15;
      if (taxableNewBase > 700000)  taxNew += Math.min(taxableNewBase - 700000, 300000) * 0.10;
      if (taxableNewBase > 300000)  taxNew += Math.min(taxableNewBase - 300000, 400000) * 0.05;
    }
    const cessNew = taxNew * 0.04;
    const totalNewTax = Math.round(taxNew + cessNew);

    // Compute Old Regime Tax
    let taxOld = 0;
    if (taxableOldBase <= 500000) {
      taxOld = 0; // Sec 87A rebate up to 5 Lakh taxable
    } else {
      if (taxableOldBase > 1000000) taxOld += (taxableOldBase - 1000000) * 0.30;
      if (taxableOldBase > 500000)  taxOld += Math.min(taxableOldBase - 500000, 500000) * 0.20;
      if (taxableOldBase > 250000)  taxOld += Math.min(taxableOldBase - 250000, 250000) * 0.05;
    }
    const cessOld = taxOld * 0.04;
    const totalOldTax = Math.round(taxOld + cessOld);

    // Update UI elements
    incomeDisplayVal.innerText = formatIndianRupee(grossVal);
    if (deductionsDisplayVal && deductionsSlider) {
      deductionsDisplayVal.innerText = `₹${deductionsVal.toLocaleString('en-IN')}`;
    }

    document.getElementById('newRegimeTax').innerText = `₹${totalNewTax.toLocaleString('en-IN')}`;
    document.getElementById('oldRegimeTax').innerText = `₹${totalOldTax.toLocaleString('en-IN')}`;
    document.getElementById('newStdDed').innerText = stdDedNew > 0 ? `₹${stdDedNew.toLocaleString('en-IN')}` : 'Nil';
    document.getElementById('newRebate').innerText = taxableNewBase <= 700000 ? 'Full Sec 87A' : 'Nil';
    document.getElementById('newCess').innerText = `₹${Math.round(cessNew).toLocaleString('en-IN')}`;
    document.getElementById('oldCess').innerText = `₹${Math.round(cessOld).toLocaleString('en-IN')}`;
    if (document.getElementById('oldDeductionsTotal')) {
      document.getElementById('oldDeductionsTotal').innerText = `₹${(stdDedOld + deductionsVal).toLocaleString('en-IN')}`;
    }

    // Recommendation logic
    const newWinnerTag = document.getElementById('newWinnerTag');
    const oldWinnerTag = document.getElementById('oldWinnerTag');
    const savingsDiffText = document.getElementById('savingsDiffText');

    if (totalNewTax < totalOldTax) {
      const diff = totalOldTax - totalNewTax;
      if (newWinnerTag) newWinnerTag.style.display = 'block';
      if (oldWinnerTag) oldWinnerTag.style.display = 'none';
      if (savingsDiffText) savingsDiffText.innerText = `You save ₹${diff.toLocaleString('en-IN')} by opting for the New Tax Regime!`;
    } else if (totalOldTax < totalNewTax) {
      const diff = totalNewTax - totalOldTax;
      if (newWinnerTag) newWinnerTag.style.display = 'none';
      if (oldWinnerTag) oldWinnerTag.style.display = 'block';
      if (savingsDiffText) savingsDiffText.innerText = `You save ₹${diff.toLocaleString('en-IN')} under Old Regime with your investments/deductions!`;
    } else {
      if (newWinnerTag) newWinnerTag.style.display = 'block';
      if (oldWinnerTag) oldWinnerTag.style.display = 'none';
      if (savingsDiffText) savingsDiffText.innerText = `Both regimes yield equal tax liability. New Regime offers simpler filing without investment locking.`;
    }

    // Section 44AB Statutory Audit Radar Logic
    const auditHeading = document.getElementById('auditRadarHeading');
    const auditDesc = document.getElementById('auditRadarDesc');
    const auditTag = document.getElementById('auditRadarTag');
    const auditIcon = document.getElementById('auditRadarIcon');

    if (currentEntity === 'business') {
      if (grossVal > 100000000) { // > 10 Crores
        auditHeading.innerText = '🚨 Sec 44AB Tax Audit is Mandatory by Chartered Accountant';
        auditDesc.innerText = `Your annual business turnover exceeds ₹10 Crores. Under Income Tax Section 44AB, an extensive Tax Audit by an FCA like CA Kiran Shinde (Form 3CA/3CD) is statutorily mandatory.`;
        auditTag.innerText = 'MANDATORY TAX AUDIT';
        auditTag.style.color = '#b91c1c';
        auditIcon.style.background = '#fee2e2';
        auditIcon.style.color = '#b91c1c';
      } else if (grossVal > 10000000) { // 1 Cr - 10 Cr
        auditHeading.innerText = '⚠️ Audit Threshold Alert: Check Cash Transactions Ratio';
        auditDesc.innerText = `For turnover between ₹1 Crore and ₹10 Crores, Tax Audit applies if cash receipts or payments exceed 5%. If transactions are >95% digital/banking, audit threshold relaxes up to ₹10 Crores.`;
        auditTag.innerText = 'CONDITIONAL AUDIT (5% CASH LIMIT)';
        auditTag.style.color = '#b45309';
        auditIcon.style.background = '#fef3c7';
        auditIcon.style.color = '#b45309';
      } else {
        auditHeading.innerText = '✓ Eligible for Presumptive Taxation (Sec 44AD)';
        auditDesc.innerText = `Turnover under ₹2-3 Crores is eligible for Presumptive Taxation u/s 44AD. Maintain books or declare minimum 6%-8% profit with zero audit compliance penalty.`;
        auditTag.innerText = 'PRESUMPTIVE COMPLIANCE';
        auditTag.style.color = '#15803d';
        auditIcon.style.background = '#dcfce7';
        auditIcon.style.color = '#15803d';
      }
    } else if (currentEntity === 'professional') {
      if (grossVal > 7500000) { // > 75 Lakhs for 44ADA
        auditHeading.innerText = '🚨 Professional Tax Audit Mandatory (Sec 44AB)';
        auditDesc.innerText = `Gross professional receipts exceed ₹75 Lakhs (enhanced limit for digital payments). Mandatory audit under Section 44AB required.`;
        auditTag.innerText = 'AUDIT REQUIRED';
        auditTag.style.color = '#b91c1c';
      } else {
        auditHeading.innerText = '✓ Presumptive Scheme 44ADA Applicable';
        auditDesc.innerText = `Declare 50% of gross receipts as taxable profit with zero detailed book-keeping or audit hassle.`;
        auditTag.innerText = 'SEC 44ADA ELIGIBLE';
        auditTag.style.color = '#15803d';
      }
    } else {
      auditHeading.innerText = 'Salaried Taxpayer Assessment';
      auditDesc.innerText = `Tax Audit does not apply to salaried individuals. Standard deduction of ₹75,000 automatically claimed under New Regime with maximum tax relief.`;
      auditTag.innerText = 'SALARIED ITR COMPLIANT';
      auditTag.style.color = '#0369a1';
    }

    // Update Consult CTA link to prefill WhatsApp message
    const consultBtn = document.getElementById('calcConsultBtn');
    if (consultBtn) {
      const msg = `Hello CA Kiran Shinde, I used your website tax calculator for ${currentEntity.toUpperCase()} income/turnover of ${formatIndianRupee(grossVal)}. Estimated tax is ₹${totalNewTax.toLocaleString('en-IN')}. I would like to schedule a formal tax planning and compliance consultation.`;
      consultBtn.href = `https://wa.me/917506647791?text=${encodeURIComponent(msg)}`;
      consultBtn.target = '_blank';
    }
  }

  if (incomeSlider) {
    incomeSlider.addEventListener('input', calculateTax);
  }
  if (deductionsSlider) {
    deductionsSlider.addEventListener('input', calculateTax);
  }

  entityBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      entityBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentEntity = btn.getAttribute('data-entity');

      if (currentEntity === 'salaried') {
        incomeLabelText.innerText = 'Gross Annual Salary Income';
        if (deductionsField) deductionsField.style.display = 'flex';
      } else if (currentEntity === 'professional') {
        incomeLabelText.innerText = 'Gross Professional Consultancy Receipts';
        if (deductionsField) deductionsField.style.display = 'flex';
      } else {
        incomeLabelText.innerText = 'Annual Business Turnover (MIDC / Trade)';
        if (deductionsField) deductionsField.style.display = 'none';
      }
      calculateTax();
    });
  });

  chipBtns.forEach(chip => {
    chip.addEventListener('click', () => {
      chipBtns.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      if (incomeSlider) {
        incomeSlider.value = chip.getAttribute('data-val');
        calculateTax();
      }
    });
  });

  calculateTax();

  // ================= 15. Dynamic Statutory Compliance Radar =================
  const complianceData = [
    {
      id: 'gstr1',
      category: 'gst',
      catLabel: 'GST Filing',
      catClass: 'cat-gst',
      title: 'GSTR-1 Monthly Return',
      desc: 'Mandatory return of outward supplies & sales for registered regular taxpayers and Tarapur MIDC manufacturers.',
      dueDay: 11, // 11th of every month
      freq: 'monthly',
      actText: 'File GSTR-1'
    },
    {
      id: 'gstr3b',
      category: 'gst',
      catLabel: 'GST Compliance',
      catClass: 'cat-gst',
      title: 'GSTR-3B Monthly Return & Tax Payment',
      desc: 'Summary return for declaring summary GST liabilities, offsetting tax, and claiming reconciled 2B Input Tax Credit (ITC).',
      dueDay: 20, // 20th of every month
      freq: 'monthly',
      actText: 'Reconcile ITC & File'
    },
    {
      id: 'tds-deposit',
      category: 'income-tax',
      catLabel: 'TDS Challan 281',
      catClass: 'cat-it',
      title: 'Monthly TDS Deposit / Challan Payment',
      desc: 'Deposit of Tax Deducted at Source under sections 194C, 194J, 194I, 192 for the preceding month.',
      dueDay: 7, // 7th of every month
      freq: 'monthly',
      actText: 'Deposit Challan'
    },
    {
      id: 'advance-tax',
      category: 'income-tax',
      catLabel: 'Advance Tax',
      catClass: 'cat-it',
      title: 'Advance Tax Installment (Sec 208/211)',
      desc: 'Quarterly payment of estimated tax liabilities for individuals & corporates to avoid Sec 234B/C penal interest.',
      dueDateStr: '15th March / 15th June',
      fixedDays: 14,
      freq: 'quarterly',
      actText: 'Calculate Advance Tax'
    },
    {
      id: 'tax-audit',
      category: 'audit',
      catLabel: 'Statutory Audit',
      catClass: 'cat-audit',
      title: 'Section 44AB Tax Audit Report (Form 3CA/3CD)',
      desc: 'Submission of Chartered Accountant certified Tax Audit report along with true & fair financial statements.',
      dueDateStr: '30th September / 31st October',
      fixedDays: 45,
      freq: 'annual',
      actText: 'Book Audit Review'
    },
    {
      id: 'roc-annual',
      category: 'audit',
      catLabel: 'Corporate MCA',
      catClass: 'cat-audit',
      title: 'ROC Annual Filing (AOC-4 & MGT-7)',
      desc: 'Submission of audited balance sheets, profit & loss, and directors report to the Registrar of Companies.',
      dueDateStr: '30th October / 29th November',
      fixedDays: 58,
      freq: 'annual',
      actText: 'MCA Compliance'
    }
  ];

  function renderComplianceCards(filter = 'all') {
    const grid = document.getElementById('complianceGrid');
    if (!grid) return;

    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.toLocaleString('default', { month: 'short' });

    const filtered = filter === 'all' ? complianceData : complianceData.filter(c => c.category === filter);

    grid.innerHTML = filtered.map(item => {
      let daysLeft = 0;
      let displayDate = '';

      if (item.freq === 'monthly') {
        if (currentDay <= item.dueDay) {
          daysLeft = item.dueDay - currentDay;
          displayDate = `${item.dueDay}th ${currentMonth}`;
        } else {
          // Next month
          daysLeft = (30 - currentDay) + item.dueDay;
          const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, item.dueDay);
          displayDate = `${item.dueDay}th ${nextMonthDate.toLocaleString('default', { month: 'short' })}`;
        }
      } else {
        daysLeft = item.fixedDays || 15;
        displayDate = item.dueDateStr;
      }

      const isUrgent = daysLeft <= 5;
      const chipClass = isUrgent ? 'urgent' : 'normal';
      const chipText = daysLeft === 0 ? 'Due Today' : `${daysLeft} Days Remaining`;

      return `
        <div class="compliance-card tilt-card">
          <div class="compliance-card-header">
            <span class="compliance-category-badge ${item.catClass}">${item.catLabel}</span>
            <span class="countdown-chip ${chipClass}"><i class="fa-regular fa-clock"></i> ${chipText}</span>
          </div>
          <h4 class="compliance-title">${item.title}</h4>
          <p class="compliance-desc">${item.desc}</p>
          <div class="compliance-footer">
            <div class="compliance-date"><i class="fa-regular fa-calendar"></i> Due: ${displayDate}</div>
            <a href="https://wa.me/917506647791?text=${encodeURIComponent(`Hello CA Kiran Shinde, I need assistance with statutory compliance for ${item.title}.`)}" target="_blank" class="compliance-action-link">
              ${item.actText} <i class="fa-solid fa-arrow-right"></i>
            </a>
          </div>
        </div>
      `;
    }).join('');
  }

  renderComplianceCards('all');

  const filterPills = document.querySelectorAll('.filter-pill');
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      renderComplianceCards(pill.getAttribute('data-filter'));
    });
  });

  // ================= 16. Double-Entry Balance Sheet Sandbox Simulation =================
  const simRebalanceBtn = document.getElementById('simRebalanceBtn');
  const scaleBeam = document.getElementById('scaleBeam');
  const balanceStatusTag = document.getElementById('balanceStatusTag');

  if (simRebalanceBtn && scaleBeam) {
    simRebalanceBtn.addEventListener('click', () => {
      // Simulate momentary imbalance and then precision stabilization
      scaleBeam.style.transform = 'rotate(-3.5deg)';
      if (balanceStatusTag) {
        balanceStatusTag.innerText = 'RECONCILING LEDGERS...';
        balanceStatusTag.style.color = '#f59e0b';
        balanceStatusTag.style.borderColor = '#f59e0b';
      }

      setTimeout(() => {
        scaleBeam.style.transform = 'rotate(2.5deg)';
      }, 350);

      setTimeout(() => {
        scaleBeam.style.transform = 'rotate(0deg)';
        if (balanceStatusTag) {
          balanceStatusTag.innerText = '✓ BALANCED 100% (Dr = Cr)';
          balanceStatusTag.style.color = '#86efac';
          balanceStatusTag.style.borderColor = '#16a34a';
        }
      }, 750);
    });
  }
});
