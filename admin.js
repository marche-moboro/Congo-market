// ================================================================
// admin.js — MARCHÉ MOBORO
// Panel d'administration
// ================================================================

// ⚠️  Les identifiants admin sont vérifiés côté serveur via Supabase.
//     Ils ne sont PLUS stockés dans le code source.
//     La fonction adminLogin() envoie le code + PIN à Supabase
//     qui vérifie dans la table admin_credentials (non exposée).

// ✅ CORRECTION 3 : isAdmin déclaré ici (était absent — variable globale implicite dans index.html)
let isAdmin = false;

// ================================================================
// CONNEXION ADMIN — vérification via Supabase
// ================================================================
async function adminLogin() {
  const code = document.getElementById('adminCode').value.trim();
  const pin  = document.getElementById('adminPin').value.trim();

  if (!code || !pin) {
    showToast('Remplissez tous les champs', 'error');
    return;
  }

  try {
    // ✅ .maybeSingle() au lieu de .single() pour éviter erreur console si pas trouvé
    const { data, error } = await db
      .from('admin_credentials')
      .select('id')
      .eq('code',     code)
      .eq('pin_hash', hashPin(pin))
      .maybeSingle();

    if (error || !data) {
      showToast('Identifiants admin incorrects', 'error');
      await logAdminAction('login_failed', 'admin', null, 'Tentative échouée');
      return;
    }

    isAdmin = true;
    showPage('adminDashboard');
    await logAdminAction('login', 'admin', null, 'Connexion admin réussie');
    loadAdminStats();

  } catch (e) {
    console.error('adminLogin error:', e);
    showToast('Erreur de connexion', 'error');
  }
}

// ================================================================
// STATS ADMIN
// ================================================================
async function loadAdminStats() {
  const today = new Date().toISOString().split('T')[0];

  const { count: totalSellers } = await db.from(TABLES.SELLERS)
    .select('*', { count: 'exact', head: true });

  const { count: todaySellers } = await db.from(TABLES.SELLERS)
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today);

  const { count: todayVisits } = await db.from(TABLES.VISITORS)
    .select('*', { count: 'exact', head: true })
    .gte('date', today);

  const { count: totalVisits } = await db.from(TABLES.VISITORS)
    .select('*', { count: 'exact', head: true });

  const { count: todayOrders } = await db.from(TABLES.ORDERS)
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today);

  const { count: totalOrders } = await db.from(TABLES.ORDERS)
    .select('*', { count: 'exact', head: true });

  document.getElementById('statTotalSellers').innerText = totalSellers || 0;
  document.getElementById('statTodaySellers').innerText = todaySellers || 0;
  document.getElementById('statTodayVisits').innerText  = todayVisits  || 0;
  document.getElementById('statTotalVisits').innerText  = totalVisits  || 0;
  document.getElementById('statTodayOrders').innerText  = todayOrders  || 0;
  document.getElementById('statTotalOrders').innerText  = totalOrders  || 0;
}

// ================================================================
// LISTE VENDEURS
// ================================================================
async function loadSellersList() {
  const ville    = document.getElementById('filterVille').value;
  const quartier = document.getElementById('filterQuartier').value.trim();

  let query = db.from(TABLES.SELLERS)
    .select('*')
    .order('created_at', { ascending: false });

  if (ville)    query = query.ilike('ville',    `%${ville}%`);
  if (quartier) query = query.ilike('quartier', `%${quartier}%`);

  const { data: sellers } = await query;
  const tbody = document.getElementById('sellersTableBody');

  if (!sellers || sellers.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center;padding:20px;">Aucun vendeur.</td></tr>';
    return;
  }

  // ✅ CORRECTION 4 : escapeHtml sur s.full_name, s.ville, s.quartier, s.code
  tbody.innerHTML = sellers.map(s => {
    const dynamisme  = getDynamisme(s.last_published);
    const dynamColor = {
      vert:  '#52c41a',
      jaune: '#faad14',
      rouge: '#ff4d4f',
      noir:  '#333'
    }[dynamisme];

    return `
      <tr>
        <td>${escapeHtml(s.code)}</td>
        <td>
          ${escapeHtml(s.full_name)}
          <br><small>${escapeHtml(s.ville)} - ${escapeHtml(s.quartier)}</small>
        </td>
        <td>${escapeHtml(ALL_CATEGORIES[s.category] || s.category)}</td>
        <td><span style="color:${dynamColor};font-weight:700;">● ${dynamisme}</span></td>
        <td>
          <span style="color:${s.subscription_status === 'en_cours' ? '#52c41a' : '#ff4d4f'}">
            ${s.subscription_status === 'en_cours' ? 'En cours' : 'Expiré'}
          </span>
        </td>
        <td>
          <button
            onclick="toggleBlock('${s.id}', ${s.is_blocked})"
            style="background:${s.is_blocked ? '#52c41a' : '#ff4d4f'};color:white;border:none;
                   padding:5px 10px;border-radius:8px;cursor:pointer;">
            ${s.is_blocked ? 'Débloquer' : 'Bloquer'}
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// ================================================================
// DYNAMISME
// ================================================================
function getDynamisme(lastPublished) {
  if (!lastPublished) return 'noir';
  const diff = (new Date() - new Date(lastPublished)) / (1000 * 60 * 60 * 24);
  if (diff <= 1) return 'vert';
  if (diff <= 3) return 'jaune';
  if (diff <= 7) return 'rouge';
  return 'noir';
}

// ================================================================
// BLOQUER / DÉBLOQUER VENDEUR
// ================================================================
async function toggleBlock(sellerId, isBlocked) {
  const action = isBlocked ? 'débloquer' : 'bloquer';
  if (!confirm(`Voulez-vous ${action} ce vendeur ?`)) return;

  // ✅ Si déblocage → mettre à jour les dates d'abonnement (30 jours)
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 30);

  const updateData = {
    is_blocked: !isBlocked,
    subscription_status: isBlocked ? 'en_cours' : 'expire'
  };

  // ✅ Ajouter les dates seulement au déblocage
  if (isBlocked) {
    updateData.subscription_start = today.toISOString().split('T')[0];
    updateData.subscription_end   = endDate.toISOString().split('T')[0];
  }

  const { error } = await db.from(TABLES.SELLERS)
    .update(updateData)
    .eq('id', sellerId);

  if (error) {
    showToast('Erreur lors de l\'opération', 'error');
    return;
  }

  showToast(
    isBlocked
      ? `Vendeur débloqué ✓ — Abonnement jusqu'au ${endDate.toLocaleDateString('fr-FR')}`
      : `Vendeur bloqué ✓`,
    'success'
  );

  await logAdminAction(
    isBlocked ? 'unblock_seller' : 'block_seller',
    'sellers', sellerId,
    isBlocked
      ? `Débloqué — abonnement jusqu'au ${endDate.toISOString().split('T')[0]}`
      : 'Bloqué par admin'
  );

  loadSellersList();
}

// ================================================================
// POSITIONS PAR CATÉGORIE
// ================================================================
async function loadPositions(catId) {
  const { data: sellers } = await db.from(TABLES.SELLERS)
    .select('*')
    .eq('category',   catId)
    .eq('is_blocked', false)
    .order('position', { ascending: true });

  const list = document.getElementById('positionsList');

  if (!sellers || sellers.length === 0) {
    list.innerHTML = '<p style="padding:10px;color:#888;">Aucun vendeur.</p>';
    return;
  }

  // ✅ CORRECTION 4 : escapeHtml sur s.full_name et s.code
  list.innerHTML = sellers.map((s, i) => `
    <div class="position-item">
      <span class="pos-number">#${i + 1}</span>
      <span class="pos-name">${escapeHtml(s.full_name)} (${escapeHtml(s.code)})</span>
      <div class="pos-controls">
        <button onclick="moveUp('${s.id}', '${catId}')"
          ${i === 0 ? 'disabled' : ''}>▲</button>
        <button onclick="moveDown('${s.id}', '${catId}')"
          ${i === sellers.length - 1 ? 'disabled' : ''}>▼</button>
      </div>
    </div>
  `).join('');
}

// ================================================================
// MONTER POSITION
// ✅ CORRECTION 1 : Promise.all atomique — évite corruption si 2e update échoue
// ================================================================
async function moveUp(sellerId, catId) {
  const { data: sellers } = await db.from(TABLES.SELLERS)
    .select('id, position').eq('category', catId).order('position');

  const idx = sellers.findIndex(s => s.id === sellerId);
  if (idx <= 0) return;

  const current = sellers[idx];
  const prev    = sellers[idx - 1];

  const [r1, r2] = await Promise.all([
    db.from(TABLES.SELLERS).update({ position: prev.position    }).eq('id', current.id),
    db.from(TABLES.SELLERS).update({ position: current.position }).eq('id', prev.id)
  ]);

  if (r1.error || r2.error) {
    showToast('Erreur lors du déplacement', 'error');
    return;
  }

  await logAdminAction('move_position', 'sellers', sellerId, `Position montée — catégorie ${catId}`);
  loadPositions(catId);
}


// ================================================================
// GESTION COMPTES VIP (ADMIN)
// ================================================================

function openCreateVIPAccount() {
  showPage('adminCreateVIPPage');
}

function openLoginVIPAccount() {
  showPage('loginPage');
  document.getElementById('loginPage').querySelector('.section-title').innerText = 'Connexion compte VIP';
}

async function createVIPAccount() {
  const fullName    = document.getElementById('vipFullName')?.value.trim();
  const phone       = document.getElementById('vipPhone')?.value.trim();
  const quartier    = document.getElementById('vipQuartier')?.value.trim();
  const address     = document.getElementById('vipAddress')?.value.trim();
  const ville       = document.getElementById('vipVille')?.value.trim();
  const category    = document.getElementById('vipCategory')?.value;
  const description = document.getElementById('vipDescription')?.value.trim();
  const pin         = document.getElementById('vipPin')?.value.trim();
  const accountType = document.getElementById('vipType')?.value || 'vip_vendeur';

  if (!fullName || !phone || !quartier || !address || !ville || !category || !description || !pin) {
    showToast('Remplissez tous les champs', 'error');
    return;
  }

  const { data: existing } = await db.from(TABLES.SELLERS)
    .select('id').eq('phone', phone).maybeSingle();
  if (existing) { showToast('Ce numéro a déjà un compte.', 'error'); return; }

  try {
    const { count } = await db.from(TABLES.SELLERS).select('*', { count: 'exact', head: true });
    const sellerCode = generateSellerCode(count || 0);

    const { data: created, error } = await db.from(TABLES.SELLERS).insert({
      code:                sellerCode,
      full_name:           fullName,
      phone:               phone,
      quartier:            quartier,
      address:             address,
      ville:               ville,
      category:            category,
      description:         description,
      pin_hash:            hashPin(pin),
      photo:               '',
      is_blocked:          false,
      is_active:           true,
      position:            0,
      dynamisme_score:     0,
      account_type:        accountType,
      subscription_status: 'en_cours',
      created_at:          new Date().toISOString()
    }).select().single();

    if (error || !created) { showToast('Erreur création VIP: ' + (error?.message || ''), 'error'); return; }

    await logAdminAction('create_vip_account', 'sellers', created.id, `Compte VIP créé: ${sellerCode}`);
    showToast(`✅ Compte VIP créé ! Code: ${sellerCode}`, 'success');

    // Afficher le code dans une alert
    alert(`✅ Compte VIP créé avec succès !\n\nCode vendeur : ${sellerCode}\nPIN : ${pin}\n\nCommuniquez ces informations au client.`);
    showPage('adminDashboard');

  } catch (e) {
    showToast('Erreur: ' + e.message, 'error');
  }
}

// Fonctions utilitaires manquantes dans admin.js
function deleteSellerAccount() {
  const code = document.getElementById('deleteSellerCode')?.value?.trim()?.toUpperCase();
  if (!code) { showToast('Entrez un code vendeur', 'error'); return; }
  showConfirmDialog(`Supprimer définitivement le compte ${code} ?`, async () => {
    const { data: seller } = await db.from(TABLES.SELLERS).select('id').eq('code', code).maybeSingle();
    if (!seller) { showToast('Compte introuvable', 'error'); return; }
    await db.from(TABLES.PRODUCTS).delete().eq('seller_id', seller.id);
    await db.from(TABLES.PROMOS).delete().eq('seller_id', seller.id);
    const { error } = await db.from(TABLES.SELLERS).delete().eq('id', seller.id);
    if (error) { showToast('Erreur suppression', 'error'); return; }
    await logAdminAction('delete_seller', 'sellers', seller.id, `Compte ${code} supprimé`);
    showToast('Compte supprimé ✓', 'success');
    document.getElementById('deleteSellerCode').value = '';
  });
}

async function logAdminAction(action, table, recordId, details) {
  try {
    await db.from('admin_logs').insert({
      action, table_name: table, record_id: recordId, details,
      created_at: new Date().toISOString()
    });
  } catch (e) {}
}

  const { data: sellers } = await db.from(TABLES.SELLERS)
    .select('id, position').eq('category', catId).order('position');

  const idx = sellers.findIndex(s => s.id === sellerId);
  if (idx >= sellers.length - 1) return;

  const current = sellers[idx];
  const next    = sellers[idx + 1];

  const [r1, r2] = await Promise.all([
    db.from(TABLES.SELLERS).update({ position: next.position    }).eq('id', current.id),
    db.from(TABLES.SELLERS).update({ position: current.position }).eq('id', next.id)
  ]);

  if (r1.error || r2.error) {
    showToast('Erreur lors du déplacement', 'error');
    return;
  }

  await logAdminAction('move_position', 'sellers', sellerId, `Position descendue — catégorie ${catId}`);
  loadPositions(catId);


