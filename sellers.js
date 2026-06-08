// ==================== SELLERS.JS ====================

// ================================================================
// ✅ CORRECTION 2 : escapeHtml déplacée au niveau global
//    (était imbriquée dans renderProducts — re-créée à chaque appel)
// ================================================================
function escapeHtml(str) {
  return str?.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;')
             .replace(/"/g, '&quot;') || '';
}

// ✅ CORRECTION 3 : addToCartFromBtn remplace l'injection de p.name dans onclick
function addToCartFromBtn(btn) {
  addToCart(btn.dataset.id, btn.dataset.name, Number(btn.dataset.price));
}

let currentCategory     = '';
let currentCategoryType = ''; // 'A' ou 'B'

// ================================================================
// Ouvrir une catégorie
// ================================================================
async function openCategory(catId, type) {
  currentCategory     = catId;
  currentCategoryType = type;

  const title = ALL_CATEGORIES[catId] || 'Vendeurs';
  document.getElementById('categoryTitle').innerText = title;

  showPage('sellersPage');
  document.getElementById('sellerList').innerHTML =
    '<div class="loading">Chargement...</div>';

  await loadSellers(catId);
}

// ================================================================
// Charger vendeurs d'une catégorie
// ================================================================
async function loadSellers(catId) {
  const list = document.getElementById('sellerList');

  try {
    const { data: sellers, error } = await db
      .from(TABLES.SELLERS)
      .select('*')
      .eq('category',   catId)
      .eq('is_blocked', false)
      .eq('is_active',  true)
      .order('position',        { ascending: true })
      .order('dynamisme_score', { ascending: false });

    if (error) {
      console.error('loadSellers Supabase error:', JSON.stringify(error));
      list.innerHTML =
        '<p style="text-align:center;padding:20px;color:#888;">Erreur de chargement. Réessayez.</p>';
      return;
    }

    if (!sellers || sellers.length === 0) {
      list.innerHTML =
        '<p style="text-align:center;padding:20px;color:#888;">Aucun vendeur dans cette catégorie pour le moment.</p>';
      return;
    }

    list.innerHTML = sellers.map(seller => `
      <div class="seller-card" data-id="${seller.id}">
        <img
          src="${escapeHtml(seller.photo) || 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=600'}"
          class="seller-image"
          onerror="this.src='https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=600'"
        >
        <div class="seller-info">
          <h3>${escapeHtml(seller.full_name)}</h3>
          <p class="seller-location">📍 ${escapeHtml(seller.quartier)}, ${escapeHtml(seller.ville)}</p>
          <p class="seller-desc">${escapeHtml(seller.description)}</p>
          <div class="seller-actions">
            <button class="view-btn"
              onclick="openSellerProducts('${seller.id}', '${currentCategoryType}')">
              Voir ses publications
            </button>
            <a href="https://wa.me/${seller.phone}" target="_blank" class="contact-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Contacter
            </a>
          </div>
        </div>
      </div>
    `).join('');

  } catch (e) {
    console.error('loadSellers exception:', e);
    list.innerHTML =
      '<p style="text-align:center;padding:20px;color:#888;">Erreur réseau. Vérifiez votre connexion.</p>';
  }
}

// ================================================================
// Ouvrir publications d'un vendeur
// ================================================================
async function openSellerProducts(sellerId, type) {
  try {
    const { data: seller, error } = await db
      .from(TABLES.SELLERS)
      .select('*')
      .eq('id', sellerId)
      .single();

    if (error || !seller) {
      console.error('openSellerProducts error:', JSON.stringify(error));
      showToast('Impossible de charger ce vendeur', 'error');
      return;
    }

    window.currentViewedSeller = seller;

    document.getElementById('sellerNameTitle').innerText    = seller.full_name;
    document.getElementById('sellerNameSubtitle').innerText =
      '📍 ' + seller.quartier + ', ' + seller.ville;

    showPage('productsPage');
    document.getElementById('productsList').innerHTML =
      '<div class="loading">Chargement...</div>';

    const { data: products, error: prodError } = await db
      .from(TABLES.PRODUCTS)
      .select('*')
      .eq('seller_id', sellerId)
      .eq('is_active',  true)
      .order('created_at', { ascending: false });

    if (prodError) {
      console.error('openSellerProducts products error:', JSON.stringify(prodError));
    }

    renderProducts(products || [], type);

products?.forEach(p => {
  recordProductView(p.id, sellerId, 'view');
});

    if (type === 'B') {
      document.getElementById('cartBar').style.display = 'flex';
      loadCart(sellerId);
    } else {
      document.getElementById('cartBar').style.display = 'none';
    }

  } catch (e) {
    console.error('openSellerProducts exception:', e);
    showToast('Erreur chargement publications', 'error');
  }
}

// ================================================================
// Afficher produits
// ================================================================
function renderProducts(products, type) {
  const list = document.getElementById('productsList');

  if (!products.length) {
    list.innerHTML =
      '<p style="text-align:center;padding:20px;color:#888;">Aucune publication pour le moment.</p>';
    return;
  }

  list.innerHTML = products.map(p => `
    <div class="product-card">
      <img
        src="${escapeHtml(p.image)}"
        onerror="this.src='https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=600'"
      >
      <div class="product-content">
        <h3>${escapeHtml(p.name)}</h3>
        <p class="product-price">${formatPrice(p.price)} FCFA</p>
        ${p.description ? `<p class="product-desc">${escapeHtml(p.description)}</p>` : ''}

        ${type === 'B'
          ? `<button class="add-btn"
               data-id="${p.id}"
               data-name="${escapeHtml(p.name)}"
               data-price="${p.price}"
               onclick="addToCartFromBtn(this)">
               🛒 Ajouter au panier
             </button>`
          : `<a href="https://wa.me/${window.currentViewedSeller?.phone}"
               target="_blank" class="contact-btn-product">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                 <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
               </svg>
               Contacter le vendeur
             </a>`
        }
      </div>
    </div>
  `).join('');
}

// ================================================================
// Navigation
// ================================================================
function backToSellers() {
  showPage('sellersPage');
  document.getElementById('cartBar').style.display = 'none';
}

function goHome() {
  showPage('homePage');
  document.getElementById('cartBar').style.display = 'none';
  cart = [];
  window.currentViewedSeller = null;
}

function goBack() {
  history.back();
}

async function recordProductView(productId, sellerId, type = 'view') {
  try {
    await db.from('product_views').insert({
      product_id: productId,
      seller_id:  sellerId,
      type:       type
    });
  } catch (e) {
    console.error('recordProductView error:', e);
  }
}