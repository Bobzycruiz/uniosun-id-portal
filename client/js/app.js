const MAX_FILE_SIZE = 500 * 1024; // 500KB, mirrors the server-side limit

const form = document.getElementById('applicationForm');
const steps = Array.from(document.querySelectorAll('.form-step'));
const stepIndicatorItems = Array.from(document.querySelectorAll('#stepIndicator .step'));
let currentStep = 1;

// --- Step navigation ---

function showStep(stepNumber) {
  steps.forEach(el => {
    el.classList.toggle('d-none', Number(el.dataset.step) !== stepNumber);
  });
  stepIndicatorItems.forEach(el => {
    const n = Number(el.dataset.step);
    el.classList.toggle('active', n === stepNumber);
    el.classList.toggle('completed', n < stepNumber);
  });
  currentStep = stepNumber;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Validates only the visible fields in the current step using the
// browser's built-in validity API, and shows Bootstrap's invalid-feedback
// text under each bad field.
function validateCurrentStep() {
  const stepEl = steps.find(s => Number(s.dataset.step) === currentStep);
  const fields = stepEl.querySelectorAll('input, select, textarea');
  let valid = true;

  fields.forEach(field => {
    field.classList.remove('is-invalid');
    if (!field.checkValidity()) {
      valid = false;
      field.classList.add('is-invalid');
      const feedback = field.parentElement.querySelector('.invalid-feedback');
      if (feedback) feedback.textContent = field.validationMessage;
    }
  });

  return valid;
}

document.querySelectorAll('.next-step').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!validateCurrentStep()) return;
    if (currentStep === 3) {
      buildPreview();
    }
    showStep(currentStep + 1);
  });
});

document.querySelectorAll('.prev-step').forEach(btn => {
  btn.addEventListener('click', () => showStep(currentStep - 1));
});

// --- File previews + client-side size/type check ---

function wireFilePreview(inputName, hintId, previewId) {
  const input = form.querySelector(`[name="${inputName}"]`);
  const hint = document.getElementById(hintId);
  const preview = document.getElementById(previewId);

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      hint.textContent = `Too large (${Math.round(file.size / 1024)}KB). Max is 500KB.`;
      hint.className = 'form-text text-danger fw-semibold';
      input.value = '';
      preview.classList.add('d-none');
      return;
    }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      hint.textContent = 'Only JPG or PNG files are allowed.';
      hint.className = 'form-text text-danger fw-semibold';
      input.value = '';
      preview.classList.add('d-none');
      return;
    }

    hint.textContent = `Looks good (${Math.round(file.size / 1024)}KB)`;
    hint.className = 'form-text text-success fw-semibold';

    const reader = new FileReader();
    reader.onload = e => {
      preview.src = e.target.result;
      preview.classList.remove('d-none');
    };
    reader.readAsDataURL(file);
  });
}

wireFilePreview('passport', 'passportHint', 'passportPreview');
wireFilePreview('signature', 'signatureHint', 'signaturePreview');

// --- Step 4: build the read-only preview from whatever is currently filled in ---

function buildPreview() {
  const data = new FormData(form);
  const get = (name) => data.get(name) || '—';

  const rows = (pairs) => pairs.map(([label, value]) =>
    `<div class="preview-row"><div class="preview-label">${label}</div><div class="preview-value">${value}</div></div>`
  ).join('');

  const passportFile = form.querySelector('[name="passport"]').files[0];
  const signatureFile = form.querySelector('[name="signature"]').files[0];

  const html = `
    <div class="preview-section-title">Personal Information</div>
    ${rows([
      ['Title', get('title')],
      ['Full Name', `${get('title')} ${get('surname')} ${get('firstName')} ${get('middleName') === '—' ? '' : get('middleName')}`],
      ['Application Type', get('applicationType')],
      ['Date of Birth', get('dateOfBirth')],
      ['Telephone', get('telephoneNumber')],
      ['Email', get('email')],
      ['Genotype', get('genotype')],
      ['Blood Group', get('bloodGroup')]
    ])}
    <div class="preview-images">
      ${passportFile ? `<img src="${document.getElementById('passportPreview').src}" alt="Passport">` : ''}
      ${signatureFile ? `<img src="${document.getElementById('signaturePreview').src}" alt="Signature">` : ''}
    </div>
    <div class="preview-section-title">Appointment Information</div>
    ${rows([
      ['Staff Number', get('staffNumber')],
      ['Designation', get('designation')],
      ['Department', get('department')]
    ])}
    <div class="preview-section-title">Next of Kin</div>
    ${rows([
      ['Full Name', get('nokFullName')],
      ['Telephone', get('nokTelephone')],
      ['Address', get('nokAddress')]
    ])}
  `;

  document.getElementById('previewTable').innerHTML = html;
}

// --- Submission ---

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitBtn = document.getElementById('submitBtn');
  const spinner = document.getElementById('submitSpinner');
  const alertBox = document.getElementById('formAlert');

  alertBox.classList.add('d-none');
  submitBtn.disabled = true;
  spinner.classList.remove('d-none');

  try {
    const formData = new FormData(form);
    const response = await fetch('/api/applications', {
      method: 'POST',
      body: formData
    });

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error('The server sent back an unexpected response. Please try again.');
    }

    if (!response.ok || !result.success) {
      if (result.errors && result.errors.length) {
        showFieldErrors(result.errors);
        throw new Error(result.message || 'Please correct the highlighted fields.');
      }
      throw new Error(result.message || 'Something went wrong. Please try again.');
    }

    // Success — send them to the printable receipt page.
    window.location.href = `receipt.html?id=${result.id}`;
  } catch (err) {
    alertBox.textContent = err.message;
    alertBox.className = 'alert alert-danger mt-3';
  } finally {
    submitBtn.disabled = false;
    spinner.classList.add('d-none');
  }
});

// Maps server-side field names back to the step they live on and jumps
// there so the user isn't stuck on the preview screen wondering what's wrong.
function showFieldErrors(errors) {
  const fieldToStep = {
    title: 1, surname: 1, firstName: 1, applicationType: 1, dateOfBirth: 1,
    telephoneNumber: 1, email: 1, genotype: 1, bloodGroup: 1,
    staffNumber: 2, designation: 2, department: 2,
    nokFullName: 3, nokAddress: 3, nokTelephone: 3
  };

  let earliestStep = 4;
  errors.forEach(err => {
    const field = form.querySelector(`[name="${err.field}"]`);
    if (field) {
      field.classList.add('is-invalid');
      const feedback = field.parentElement.querySelector('.invalid-feedback');
      if (feedback) feedback.textContent = err.message;
    }
    if (fieldToStep[err.field] && fieldToStep[err.field] < earliestStep) {
      earliestStep = fieldToStep[err.field];
    }
  });

  showStep(earliestStep);
}
