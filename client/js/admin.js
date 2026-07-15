let currentPage = 1;
const LIMIT = 10;
let detailModal;

document.addEventListener('DOMContentLoaded', () => {
  detailModal = new bootstrap.Modal(document.getElementById('detailModal'));
  loadApplications();
});

document.getElementById('searchBtn').addEventListener('click', () => {
  currentPage = 1;
  loadApplications();
});
document.getElementById('clearBtn').addEventListener('click', () => {
  document.getElementById('searchSurname').value = '';
  document.getElementById('searchStaffNumber').value = '';
  currentPage = 1;
  loadApplications();
});

async function loadApplications() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Loading…</td></tr>';

  const surname = document.getElementById('searchSurname').value.trim();
  const staffNumber = document.getElementById('searchStaffNumber').value.trim();

  const query = new URLSearchParams({
    page: currentPage,
    limit: LIMIT
  });
  if (surname) query.set('surname', surname);
  if (staffNumber) query.set('staffNumber', staffNumber);

  try {
    const res = await fetch(`/api/applications?${query.toString()}`);
    const result = await res.json();

    if (!result.success) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">${result.message}</td></tr>`;
      return;
    }

    if (result.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No applications found.</td></tr>';
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    tbody.innerHTML = result.data.map(row => `
      <tr>
        <td>${esc(row.application_id)}</td>
        <td>${esc(row.title)} ${esc(row.surname)} ${esc(row.first_name)}</td>
        <td>${esc(row.staff_number)}</td>
        <td>${esc(row.department)}</td>
        <td><span class="status-badge status-${row.status}">${row.status}</span></td>
        <td>${new Date(row.submitted_at).toLocaleDateString()}</td>
        <td><button class="btn btn-sm btn-outline-secondary" onclick="openDetail(${row.id})">View</button></td>
      </tr>
    `).join('');

    renderPagination(result.page, result.totalPages);
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">Could not reach the server.</td></tr>';
  }
}

function renderPagination(page, totalPages) {
  const pag = document.getElementById('pagination');
  if (totalPages <= 1) { pag.innerHTML = ''; return; }

  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    html += `<li class="page-item ${i === page ? 'active' : ''}">
      <button class="page-link" onclick="goToPage(${i})">${i}</button>
    </li>`;
  }
  pag.innerHTML = html;
}

function goToPage(page) {
  currentPage = page;
  loadApplications();
}

let activeApplicationId = null;

async function openDetail(id) {
  activeApplicationId = id;
  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = '<p class="text-muted">Loading…</p>';
  detailModal.show();

  try {
    const res = await fetch(`/api/applications/${id}`);
    const result = await res.json();
    if (!result.success) {
      modalBody.innerHTML = `<p class="text-danger">${result.message}</p>`;
      return;
    }

    const a = result.data;
    document.getElementById('statusSelect').value = a.status;

    modalBody.innerHTML = `
      <div class="row mb-3">
        <div class="col-8">
          <p class="mb-1"><strong>Application ID:</strong> ${esc(a.application_id)}</p>
          <p class="mb-1"><strong>Name:</strong> ${esc(a.title)} ${esc(a.surname)} ${esc(a.first_name)} ${esc(a.middle_name)}</p>
          <p class="mb-1"><strong>Application Type:</strong> ${esc(a.application_type)}</p>
          <p class="mb-1"><strong>Date of Birth:</strong> ${a.date_of_birth ? new Date(a.date_of_birth).toLocaleDateString() : '—'}</p>
          <p class="mb-1"><strong>Phone:</strong> ${esc(a.telephone_number)}</p>
          <p class="mb-1"><strong>Email:</strong> ${esc(a.email)}</p>
          <p class="mb-1"><strong>Genotype:</strong> ${esc(a.genotype)} &nbsp; <strong>Blood Group:</strong> ${esc(a.blood_group)}</p>
        </div>
        <div class="col-4 d-flex flex-column gap-2 align-items-end">
          <div>
            <p class="small text-muted mb-1 text-center">Passport</p>
            <img src="${a.passport_path}" style="width:90px;height:108px;object-fit:cover;border-radius:6px;border:1px solid #ddd;">
          </div>
          <div>
            <p class="small text-muted mb-1 text-center">Signature</p>
            <img src="${a.signature_path}" style="width:90px;height:50px;object-fit:contain;border-radius:6px;border:1px solid #ddd;">
          </div>
        </div>
      </div>
      <hr>
      <p class="mb-1"><strong>Staff Number:</strong> ${esc(a.staff_number)}</p>
      <p class="mb-1"><strong>Designation:</strong> ${esc(a.designation)}</p>
      <p class="mb-1"><strong>Department:</strong> ${esc(a.department)}</p>
      <hr>
      <p class="mb-1"><strong>Next of Kin:</strong> ${esc(a.nok_full_name)}</p>
      <p class="mb-1"><strong>NOK Phone:</strong> ${esc(a.nok_telephone)}</p>
      <p class="mb-1"><strong>NOK Address:</strong> ${esc(a.nok_address)}</p>
      <hr>
      <p class="small text-muted mb-0">Submitted: ${new Date(a.submitted_at).toLocaleString()}</p>
    `;
  } catch (err) {
    modalBody.innerHTML = '<p class="text-danger">Could not reach the server.</p>';
  }
}

document.getElementById('updateStatusBtn').addEventListener('click', async () => {
  if (!activeApplicationId) return;
  const status = document.getElementById('statusSelect').value;

  try {
    const res = await fetch(`/api/applications/${activeApplicationId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const result = await res.json();
    if (result.success) {
      detailModal.hide();
      loadApplications();
    } else {
      alert(result.message);
    }
  } catch (err) {
    alert('Could not reach the server.');
  }
});

function esc(str) {
  return (str === null || str === undefined || str === '') ? '—' : String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
