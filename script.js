const boardElement = document.getElementById("board");
const turnIndicator = document.getElementById("turnIndicator");
const statusText = document.getElementById("status");
const supernovaControls = document.getElementById("supernovaControls");
const supernovaMessage = document.getElementById("supernovaMessage");
const promotionControls = document.getElementById("promotionControls");

const SIZE = 12;

let board = [];
let currentTurn = "White";
let selected = null;
let gameOver = false;
let history = [];
let future = [];
let explosionPending = null;
let enPassantTarget = null;
let promotionPending = null; // Track pending promotion {r, c, color}

const pieces = {
  Pawn: "P",
  Wormhole: "WO",
  BlackHole: "BH",
  WhiteHole: "WH",
  Fluctuator: "F",
  Supernova: "SN",
  Photon: "PH",
  Queen: "Q",
  King: "K"
};

const arrows = {
  "1,0": "↓",
  "-1,0": "↑",
  "0,1": "→",
  "0,-1": "←",
  "1,1": "↘",
  "1,-1": "↙",
  "-1,1": "↗",
  "-1,-1": "↖"
};

// ================= FLUCTUATOR =================
function getFluctuatorMoves(r, c, piece) {
  if (!piece.fluctuatorMode) {
    piece.fluctuatorMode = 'rook';
  }
  
  const moves = [];
  
  if (piece.fluctuatorMode === 'rook') {
    const rookDirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const [dr, dc] of rookDirs) {
      for (let d = 1; d <= 2; d++) {
        const nr = r + dr * d;
        const nc = c + dc * d;
        if (!inBounds(nr, nc)) break;
        
        const targetSquare = board[nr][nc];
        
        // Check if this is an adjacent friendly wormhole
        if (d === 1 && targetSquare && 
            targetSquare.type === pieces.Wormhole && 
            targetSquare.color === piece.color &&
            canUseTeleportation(pieces.Fluctuator)) {
          // Add wormhole square for teleportation
          moves.push({ r: nr, c: nc });
          break;
        }
        
        if (targetSquare) {
          if (targetSquare.color !== piece.color) {
            moves.push({ r: nr, c: nc });
          }
          break;
        }
        moves.push({ r: nr, c: nc });
      }
    }
  } else {
    const bishopDirs = [[1,1],[1,-1],[-1,1],[-1,-1]];
    for (const [dr, dc] of bishopDirs) {
      for (let d = 1; d <= 2; d++) {
        const nr = r + dr * d;
        const nc = c + dc * d;
        if (!inBounds(nr, nc)) break;
        
        const targetSquare = board[nr][nc];
        
        // Check if this is an adjacent friendly wormhole
        if (d === 1 && targetSquare && 
            targetSquare.type === pieces.Wormhole && 
            targetSquare.color === piece.color &&
            canUseTeleportation(pieces.Fluctuator)) {
          // Add wormhole square for teleportation
          moves.push({ r: nr, c: nc });
          break;
        }
        
        if (targetSquare) {
          if (targetSquare.color !== piece.color) {
            moves.push({ r: nr, c: nc });
          }
          break;
        }
        moves.push({ r: nr, c: nc });
      }
    }
  }
  
  return moves;
}

// Also need to add Fluctuator to canUseTeleportation:
function canUseTeleportation(pieceType) {
  const teleportablePieces = [pieces.Queen, pieces.Wormhole, pieces.BlackHole, 
                             pieces.WhiteHole, pieces.Photon, pieces.Fluctuator]; // Added Fluctuator
  return teleportablePieces.includes(pieceType);
}
function toggleFluctuatorMode(piece) {
  if (piece.type === pieces.Fluctuator) {
    piece.fluctuatorMode = piece.fluctuatorMode === 'rook' ? 'bishop' : 'rook';
  }
}

// ================= PHOTON =================
function photonMoves(r, c, p) {
  const moves = [];
  const bishopDirs = [[1,1],[1,-1],[-1,1],[-1,-1]];
  
  for (let [dr, dc] of bishopDirs) {
    let nr = r, nc = c, reflected = false;

    while (true) {
      let tr = nr + dr, tc = nc + dc;

      if (!inBounds(tr, tc)) {
        if (reflected) break;
        if (tr < 0 || tr >= SIZE) dr *= -1;
        if (tc < 0 || tc >= SIZE) dc *= -1;
        reflected = true;
        continue;
      }

      nr = tr; nc = tc;

// White hole blocks photon vision (except Queen, but photon is not immune)
if (isInWhiteHoleRadius(nr, nc, p.color)) {
  break;
}


      const targetSquare = board[nr][nc];
      if (targetSquare && 
          targetSquare.type === pieces.Wormhole && 
          targetSquare.color === p.color &&
          canUseTeleportation(p.type)) {
        
        moves.push({ r: nr, c: nc });
        break;
      }
      
      if (targetSquare) {
        if (targetSquare.color !== p.color)
          moves.push({ r: nr, c: nc });
        break;
      }

      moves.push({ r: nr, c: nc });
    }
  }
  return moves;
}

// ================= BLACK/WHITE HOLE EFFECTS =================
function getHoleRadius(r, c, pieceType) {
  const radius = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(nr, nc)) {
        radius.push({ r: nr, c: nc });
      }
    }
  }
  return radius;
}

function isInBlackHoleRadius(r, c, color) {
  for (let sr = 0; sr < SIZE; sr++) {
    for (let sc = 0; sc < SIZE; sc++) {
      const piece = board[sr][sc];
      if (piece && 
          piece.type === pieces.BlackHole && 
          piece.color !== color) {
        const dr = Math.abs(r - sr);
        const dc = Math.abs(c - sc);
        if (dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0)) {
          return true;
        }
      }
    }
  }
  return false;
}

function isInWhiteHoleRadius(r, c, color) {
  for (let sr = 0; sr < SIZE; sr++) {
    for (let sc = 0; sc < SIZE; sc++) {
      const piece = board[sr][sc];
      if (piece && 
          piece.type === pieces.WhiteHole && 
          piece.color !== color) {
        const dr = Math.abs(r - sr);
        const dc = Math.abs(c - sc);
        if (dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0)) {
          return true;
        }
      }
    }
  }
  return false;
}

function isImmuneToHoles(pieceType) {
  return pieceType === pieces.King || pieceType === pieces.Queen;
}

function wouldLeaveBlackHoleRadius(startR, startC, endR, endC, piece) {
  if (isImmuneToHoles(piece.type)) return false;
  
  if (!isInBlackHoleRadius(startR, startC, piece.color)) {
    return false;
  }
  
  const destPiece = board[endR][endC];
  if (destPiece && destPiece.type === pieces.BlackHole && destPiece.color !== piece.color) {
    return false;
  }
  
  if (isInBlackHoleRadius(endR, endC, piece.color)) {
    return false;
  }
  
  return true;
}

function wouldEnterWhiteHoleRadius(endR, endC, piece) {
  if (isImmuneToHoles(piece.type)) return false;
  
  if (!isInWhiteHoleRadius(endR, endC, piece.color)) {
    return false;
  }
  
  const destPiece = board[endR][endC];
  if (destPiece && destPiece.type === pieces.WhiteHole && destPiece.color !== piece.color) {
    return false;
  }
  
  return true;
}

// ================= SUPERNOVA =================
function getExplosionRadius(r, c) {
  const affected = [];
  // Create star pattern: horizontal/vertical lines of length 5 centered at (r,c)
  // Horizontal line: 2 squares left and right
  for (let dc = -2; dc <= 2; dc++) {
    if (dc === 0) continue;
    const nc = c + dc;
    if (inBounds(r, nc)) {
      affected.push({ r, c: nc });
    }
  }
  
  // Vertical line: 2 squares up and down
  for (let dr = -2; dr <= 2; dr++) {
    if (dr === 0) continue;
    const nr = r + dr;
    if (inBounds(nr, c)) {
      affected.push({ r: nr, c });
    }
  }
  
  // The 8 adjacent squares (Manhattan distance 1)
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(nr, nc)) {
        // Check if not already added (not part of horizontal/vertical lines)
        const isOnLine = (dr === 0 && Math.abs(dc) <= 2) || (dc === 0 && Math.abs(dr) <= 2);
        if (!isOnLine) {
          affected.push({ r: nr, c: nc });
        }
      }
    }
  }
  
  // Add the supernova's own square
  affected.push({ r, c });
  
  return affected;
}

function canExplode(r, c) {
  const piece = board[r][c];
  if (!piece || piece.type !== pieces.Supernova) return false;

  const radius = getExplosionRadius(r, c);
  
  let hasEnemies = false;
  for (const pos of radius) {
    const p = board[pos.r][pos.c];
    if (p && p.color !== piece.color) {
      hasEnemies = true;
      break;
    }
  }
  
  if (!hasEnemies) return false;

  for (const pos of radius) {
    const p = board[pos.r][pos.c];
    if (p && p.color === piece.color && p.type === pieces.King) {
      return false;
    }
  }

  return true;
}

function initiateExplosion(r, c) {
  if (!canExplode(r, c)) {
    statusText.textContent = "Cannot explode: No valid targets or friendly King in range";
    return;
  }

  explosionPending = { r, c };
  const radius = getExplosionRadius(r, c);
  
  clearHighlights();
  for (const pos of radius) {
    highlightExplosion(pos.r, pos.c);
  }

  supernovaMessage.textContent = "Trigger Supernova Explosion?";
  supernovaControls.classList.add("active");
}

function confirmExplosion() {
  if (!explosionPending) return;

  saveState();
  
  const { r, c } = explosionPending;
  const radius = getExplosionRadius(r, c);

  let kingDestroyed = false;
  const supernovaColor = board[r][c].color;
  
  for (const pos of radius) {
    const p = board[pos.r][pos.c];
    if (p && p.type === pieces.King && p.color !== supernovaColor) {
      kingDestroyed = true;
      break;
    }
  }

  for (const pos of radius) {
    board[pos.r][pos.c] = null;
  }

  explosionPending = null;
  supernovaControls.classList.remove("active");
  clearHighlights();
  enPassantTarget = null;
  
  currentTurn = opponent(currentTurn);

  if (kingDestroyed) {
    gameOver = true;
    statusText.textContent = `${opponent(currentTurn)} wins by Supernova!`;
  } else if (isKingInCheck(currentTurn)) {
    if (!hasAnyLegalMove(currentTurn)) {
      gameOver = true;
      statusText.textContent = `${opponent(currentTurn)} wins by checkmate`;
    } else {
      statusText.textContent = `${currentTurn} is in check`;
    }
  } else {
    statusText.textContent = "";
  }

  updateTurnText();
  renderBoard();
}

function cancelExplosion() {
  explosionPending = null;
  supernovaControls.classList.remove("active");
  clearHighlights();
  renderBoard();
}

// ================= WORMHOLE TELEPORTATION =================
function getWormholes(color = null) {
  const wormholes = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const piece = board[r][c];
      if (piece && piece.type === pieces.Wormhole) {
        if (!color || piece.color === color) {
          wormholes.push({ r, c, piece });
        }
      }
    }
  }
  return wormholes;
}

function canUseTeleportation(pieceType) {
  const teleportablePieces = [pieces.Queen, pieces.Wormhole, pieces.BlackHole, 
                             pieces.WhiteHole, pieces.Photon, pieces.Fluctuator]; // ADDED FLUCTUATOR
  return teleportablePieces.includes(pieceType);
}

// ... rest of the code remains the same ...
function getDirectionToWormhole(piecePos, wormholePos) {
  const dr = wormholePos.r - piecePos.r;
  const dc = wormholePos.c - piecePos.c;
  
  const dirDr = dr === 0 ? 0 : dr / Math.abs(dr);
  const dirDc = dc === 0 ? 0 : dc / Math.abs(dc);
  
  return { dr: dirDr, dc: dirDc };
}

function isAdjacentToWormhole(piecePos, wormholePos) {
  const dr = Math.abs(piecePos.r - wormholePos.r);
  const dc = Math.abs(piecePos.c - wormholePos.c);
  return dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0);
}

function getTeleportExits(piecePos, wormholePos, piece) {
  if (!isAdjacentToWormhole(piecePos, wormholePos)) {
    return [];
  }
  
  const direction = getDirectionToWormhole(piecePos, wormholePos);
  const wormholes = getWormholes(piece.color);
  
  // If only 1 wormhole (shouldn't happen), no teleport
  if (wormholes.length <= 1) return [];
  
  const exits = [];
  
  for (const otherWormhole of wormholes) {
    // Skip the entry wormhole
    if (otherWormhole.r === wormholePos.r && otherWormhole.c === wormholePos.c) {
      continue;
    }
    
    const exitRow = otherWormhole.r + direction.dr;
    const exitCol = otherWormhole.c + direction.dc;
    
    if (!inBounds(exitRow, exitCol)) continue;
    
    const targetPiece = board[exitRow][exitCol];
    if (targetPiece && targetPiece.color === piece.color) continue;
    
    exits.push({
      r: exitRow,
      c: exitCol,
      entryWormhole: wormholePos,
      exitWormhole: { r: otherWormhole.r, c: otherWormhole.c },
      direction: direction,
      wormholeChoice: { r: otherWormhole.r, c: otherWormhole.c }
    });
  }
  
  return exits;
}

// ================= PROMOTION =================
function checkPromotion(r, c) {
  const piece = board[r][c];
  if (!piece || piece.type !== pieces.Pawn) return false;
  
  // Check if pawn reached enemy backrank
  if (piece.color === "White" && r === 0) return true;
  if (piece.color === "Black" && r === SIZE - 1) return true;
  
  return false;
}

function initiatePromotion(r, c) {
  promotionPending = { r, c, color: board[r][c].color };
  promotionControls.classList.add("active");
}

function choosePromotion(pieceType) {
  if (!promotionPending) return;
  
  const { r, c, color } = promotionPending;
  
  // Create the new piece
  let newPiece;
  switch(pieceType) {
    case "Queen":
      newPiece = { type: pieces.Queen, color, moved: true };
      break;
    case "Wormhole":
      newPiece = { type: pieces.Wormhole, color, moved: true };
      break;
    case "BlackHole":
      newPiece = { type: pieces.BlackHole, color, moved: true };
      break;
    case "WhiteHole":
      newPiece = { type: pieces.WhiteHole, color, moved: true };
      break;
    case "Fluctuator":
      newPiece = { type: pieces.Fluctuator, color, moved: true, fluctuatorMode: 'rook' };
      break;
    case "Supernova":
      newPiece = { type: pieces.Supernova, color, moved: true };
      break;
    case "Photon":
      newPiece = { type: pieces.Photon, color, moved: true };
      break;
    default:
      newPiece = { type: pieces.Queen, color, moved: true }; // Default to queen
  }
  
  // Replace the pawn with the new piece
  board[r][c] = newPiece;
  
  promotionPending = null;
  promotionControls.classList.remove("active");
  
  // SWITCH TURN AFTER PROMOTION (this was missing!)
  currentTurn = opponent(currentTurn);
  
  // Check for check/checkmate after promotion
  if (isKingInCheck(currentTurn)) {
    if (!hasAnyLegalMove(currentTurn)) {
      gameOver = true;
      statusText.textContent = `${opponent(currentTurn)} wins by checkmate`;
    } else {
      statusText.textContent = `${currentTurn} is in check`;
    }
  } else {
    statusText.textContent = "";
  }
  
  updateTurnText();
  renderBoard();
}

// ================= SETUP =================
function setupBoard() {
  board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  currentTurn = "White";
  selected = null;
  gameOver = false;
  history = [];
  future = [];
  explosionPending = null;
  enPassantTarget = null;
  promotionPending = null;
  statusText.textContent = "";
  supernovaControls.classList.remove("active");
  promotionControls.classList.remove("active");

  const backRank = [
    pieces.BlackHole,
    pieces.Wormhole,
    pieces.Supernova,
    pieces.Fluctuator,
    pieces.Photon,
    pieces.Queen,
    pieces.King,
    pieces.Photon,
    pieces.Fluctuator,
    pieces.Supernova,
    pieces.Wormhole,
    pieces.WhiteHole
  ];

  for (let x = 0; x < SIZE; x++) {
    board[0][x] = {
      type: backRank[x],
      color: "Black",
      moved: false
    };
    
    if (backRank[x] === pieces.Fluctuator) {
      board[0][x].fluctuatorMode = 'bishop';
    }
    
    board[1][x] = { type: pieces.Pawn, color: "Black", moved: false };
    board[SIZE - 2][x] = { type: pieces.Pawn, color: "White", moved: false };
    
    board[SIZE - 1][x] = {
      type: backRank[x],
      color: "White",
      moved: false
    };
    
    if (backRank[x] === pieces.Fluctuator) {
      board[SIZE - 1][x].fluctuatorMode = 'bishop';
    }
  }

  renderBoard();
  updateTurnText();
}

// ================= SVG ICONS =================
function getPieceSVG(pieceType, color) {
  const isWhite = color === "White";
  const fillColor = isWhite ? "#f5f5f5" : "#111111";
  const strokeColor = isWhite ? "#111111" : "#f5f5f5";
  const strokeWidth = 1.6;

  const baseStyle = `fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`;

  const icons = {

    [pieces.Pawn]: `
      <path d="M20,10 C20,6 25,6 25,10 C25,14 27,16 27,25 C27,32 18,32 18,25 C18,16 20,14 20,10 Z" ${baseStyle}/> 
      <path d="M15,25 L30,25" stroke="${strokeColor}" stroke-width="2"/>
    `,

    // WORMHOLE — SPIRAL (SWAPPED COLORS)
[pieces.Wormhole]: `
  <path d="M22.5 10
           C30 10, 35 15, 35 22.5
           C35 30, 30 35, 22.5 35
           C15 35, 10 30, 10 22.5
           C10 16, 15 12, 22.5 12
           C27 12, 30 16, 30 22.5
           C30 27, 27 30, 22.5 30"
        fill="none"
        stroke="${fillColor}"
        stroke-width="2.8"/>
  <circle cx="22.5" cy="22.5" r="2.8" fill="${fillColor}"/>
`,

   // BLACK HOLE — INWARD ARROWS (MOVED INWARD)
[pieces.BlackHole]: `
  <circle cx="22.5" cy="22.5" r="11" ${baseStyle}/>
  <circle cx="22.5" cy="22.5" r="4" fill="${strokeColor}"/>

  <!-- arrows -->
  <path d="M22.5 14 L22.5 18
           M22.5 31 L22.5 27
           M14 22.5 L18 22.5
           M31 22.5 L27 22.5"
        stroke="${strokeColor}" stroke-width="2"/>

  <path d="M20.5 16 L22.5 18 L24.5 16
           M20.5 29 L22.5 27 L24.5 29
           M16 20.5 L18 22.5 L16 24.5
           M29 20.5 L27 22.5 L29 24.5"
        fill="${strokeColor}"/>
`,

    // WHITE HOLE — OUTWARD ARROWS
    [pieces.WhiteHole]: `
      <circle cx="22.5" cy="22.5" r="10" ${baseStyle}/>
      <path d="M22.5 8 L22.5 2 M22.5 37 L22.5 43
               M8 22.5 L2 22.5 M37 22.5 L43 22.5"
            stroke="${strokeColor}" stroke-width="2"/>
      <path d="M20 4 L22.5 2 L25 4
               M20 41 L22.5 43 L25 41
               M4 20 L2 22.5 L4 25
               M41 20 L43 22.5 L41 25"
            fill="${strokeColor}"/>
    `,

   // FLUCTUATOR — NORMAL COLORS
[pieces.Fluctuator]: `
  <circle cx="15" cy="22.5" r="5" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>
  <circle cx="22.5" cy="15" r="5" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>
  <circle cx="30" cy="22.5" r="5" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>
  <path d="M15 22.5 L22.5 15 L30 22.5"
        stroke="${strokeColor}" stroke-width="2" fill="none"/>
`,

    // SUPERNOVA — STAR
    [pieces.Supernova]: `
      <path d="M22.5 6 L25.5 17 L36 22.5
               L25.5 28 L22.5 39
               L19.5 28 L9 22.5
               L19.5 17 Z"
            ${baseStyle}/>
      <circle cx="22.5" cy="22.5" r="3" fill="${strokeColor}"/>
    `,

   // PHOTON — COLORS SWAPPED
[pieces.Photon]: `
  <path d="M10,22.5 C13,18 18,27 22.5,22.5 C27,18 32,27 35,22.5"
        stroke="${fillColor}" stroke-width="3" fill="none"/>
  <circle cx="22.5" cy="22.5" r="5"
          fill="${strokeColor}" stroke="${fillColor}" stroke-width="2"/>
  <circle cx="22.5" cy="22.5" r="2" fill="${fillColor}"/>
`,

    [pieces.Queen]: `
      <path d="M22.5,10 L27,20 L35,22 L30,30 L27,35 L18,35 L15,30 L10,22 L18,20 Z" ${baseStyle}/> 
      <circle cx="22.5" cy="12" r="2" fill="${strokeColor}"/>
      <circle cx="17" cy="16" r="1.5" fill="${strokeColor}"/> 
      <circle cx="28" cy="16" r="1.5" fill="${strokeColor}"/>
    `,

    [pieces.King]: `
      <path d="M22.5,10 L27,20 L35,22 L30,30 L27,35 L18,35 L15,30 L10,22 L18,20 Z" ${baseStyle}/>
      <path d="M22.5,7 L22.5,10 M20,8 L25,8" stroke="${strokeColor}" stroke-width="2"/> 
      <rect x="20" y="25" width="5" height="10" ${baseStyle} fill="${strokeColor}"/>
    `
  };

  return `
    <svg width="45" height="45" viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg">
      ${icons[pieceType]}
    </svg>
  `;
}

// ================= RENDER =================
function renderBoard() {
  boardElement.innerHTML = "";
  boardElement.style.display = "grid";
  boardElement.style.gridTemplateColumns = `repeat(${SIZE}, 60px)`;
  boardElement.style.gridTemplateRows = `repeat(${SIZE}, 60px)`;
  boardElement.style.border = "4px solid #444";
  boardElement.style.boxShadow = "0 0 20px #000";

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const sq = document.createElement("div");
      sq.className = `square ${(r + c) % 2 === 0 ? "light" : "dark"}`;
      sq.dataset.r = r;
      sq.dataset.c = c;
      sq.style.position = "relative";
      sq.style.display = "flex";
      sq.style.alignItems = "center";
      sq.style.justifyContent = "center";

      const p = board[r][c];
      if (p) {
        sq.innerHTML = getPieceSVG(p.type, p.color);
        
        if (p.type === pieces.King && isKingInCheck(p.color)) {
          sq.classList.add("king-in-check");
        }
        
        if (selected && selected.r === r && selected.c === c && 
            p.type === pieces.Supernova && canExplode(r, c)) {
          const btn = document.createElement("div");
          btn.className = "explosion-btn";
          btn.textContent = "💥";
          btn.onclick = (e) => {
            e.stopPropagation();
            initiateExplosion(r, c);
          };
          sq.appendChild(btn);
        }
        
        if (p.type === pieces.Fluctuator && selected && selected.r === r && selected.c === c) {
          const modeIndicator = document.createElement("div");
          modeIndicator.className = "mode-indicator";
          modeIndicator.textContent = p.fluctuatorMode === 'rook' ? 'R' : 'B';
          modeIndicator.style.position = "absolute";
          modeIndicator.style.top = "2px";
          modeIndicator.style.left = "2px";
          modeIndicator.style.fontSize = "10px";
          modeIndicator.style.background = "rgba(0,0,0,0.5)";
          modeIndicator.style.color = "#fff";
          modeIndicator.style.padding = "1px 3px";
          modeIndicator.style.borderRadius = "3px";
          sq.appendChild(modeIndicator);
        }
      }

      sq.onclick = () => onSquareClick(r, c);
      boardElement.appendChild(sq);
    }
  }
  
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = board[r][c];
      if (p && (p.type === pieces.BlackHole || p.type === pieces.WhiteHole)) {
        const radius = getHoleRadius(r, c, p.type);
        for (const pos of radius) {
          const radiusSq = document.querySelector(`.square[data-r='${pos.r}'][data-c='${pos.c}']`);
          if (radiusSq) {
            radiusSq.classList.add(p.type === pieces.BlackHole ? "black-hole-radius" : "white-hole-radius");
          }
        }
      }
    }
  }
}

// ================= INPUT =================
function onSquareClick(r, c) {
  if (gameOver || explosionPending || promotionPending) return;

  const p = board[r][c];

  if (!selected) {
    if (!p || p.color !== currentTurn) return;
    selected = { r, c };
    renderBoard();
    showLegalMoves(r, c);
    return;
  }

  if (p && p.color === currentTurn && p.type !== pieces.Wormhole) {
    selected = { r, c };
    renderBoard();
    showLegalMoves(r, c);
    return;
  }

  const piece = board[selected.r][selected.c];
  const moves = getLegalMoves(selected.r, selected.c);
  
  // Check for teleport moves
  for (const m of moves) {
    const targetSquare = board[m.r][m.c];
    if (targetSquare && 
        targetSquare.type === pieces.Wormhole && 
        targetSquare.color === piece.color &&
        canUseTeleportation(piece.type)) {
      
      const teleportExits = getTeleportExits({r: selected.r, c: selected.c}, m, piece);
      for (const exit of teleportExits) {
        if (exit.r === r && exit.c === c) {
          executeTeleport(selected.r, selected.c, m.r, m.c, exit);
          selected = null;
          clearHighlights();
          return;
        }
      }
    }
  }

  if (isLegalMove(selected.r, selected.c, r, c)) {
    const targetPiece = board[r][c];
    if (targetPiece && targetPiece.type === pieces.Wormhole && targetPiece.color === piece.color) {
      selected = null;
      clearHighlights();
      renderBoard();
      return;
    }
    
    makeMove(selected.r, selected.c, r, c);
    selected = null;
    clearHighlights();
    return;
  }

  selected = null;
  clearHighlights();
  renderBoard();
}

function isLegalMove(fr, fc, tr, tc) {
  const moves = getLegalMoves(fr, fc);
  return moves.some(m => m.r === tr && m.c === tc);
}

// ================= MOVE =================
function makeMove(fr, fc, tr, tc) {
  saveState();

  const piece = board[fr][fc];
  const targetSquare = board[tr][tc];
  
  if (targetSquare && 
      targetSquare.type === pieces.Wormhole && 
      targetSquare.color === piece.color) {
    return;
  }
  
  // Check for en passant capture
  if (piece.type === pieces.Pawn && enPassantTarget && 
      tr === enPassantTarget.r && tc === enPassantTarget.c) {
    const captureDir = piece.color === "White" ? 1 : -1;
    board[tr + captureDir][tc] = null;
  }
  
  board[tr][tc] = piece;
  board[fr][fc] = null;
  piece.moved = true;
  
  // Set en passant target if pawn moved 2 squares
  if (piece.type === pieces.Pawn && Math.abs(tr - fr) === 2) {
    const passantRow = piece.color === "White" ? tr + 1 : tr - 1;
    enPassantTarget = { r: passantRow, c: tc };
  } else {
    enPassantTarget = null;
  }
  
  toggleFluctuatorMode(piece);

  // Check for promotion
  if (piece.type === pieces.Pawn && checkPromotion(tr, tc)) {
    initiatePromotion(tr, tc);
    // Don't switch turns yet - wait for promotion choice
    renderBoard();
    return;
  }

  currentTurn = opponent(currentTurn);

  if (isKingInCheck(currentTurn)) {
    if (!hasAnyLegalMove(currentTurn)) {
      gameOver = true;
      statusText.textContent = `${opponent(currentTurn)} wins by checkmate`;
    } else {
      statusText.textContent = `${currentTurn} is in check`;
    }
  } else {
    statusText.textContent = "";
  }

  updateTurnText();
  renderBoard();
}

function executeTeleport(fr, fc, wr, wc, teleportExit) {
  saveState();

  const piece = board[fr][fc];
  
  board[fr][fc] = null;
  board[teleportExit.r][teleportExit.c] = piece;
  piece.moved = true;
  
  enPassantTarget = null;
  toggleFluctuatorMode(piece);
  
  // Check for promotion after teleport
  if (piece.type === pieces.Pawn && checkPromotion(teleportExit.r, teleportExit.c)) {
    initiatePromotion(teleportExit.r, teleportExit.c);
    renderBoard();
    return;
  }
  
  currentTurn = opponent(currentTurn);
  
  if (isKingInCheck(currentTurn)) {
    if (!hasAnyLegalMove(currentTurn)) {
      gameOver = true;
      statusText.textContent = `${opponent(currentTurn)} wins by checkmate`;
    } else {
      statusText.textContent = `${currentTurn} is in check`;
    }
  } else {
    statusText.textContent = "";
  }
  
  updateTurnText();
  renderBoard();
}

// ================= LEGAL MOVES =================
function showLegalMoves(r, c) {
  clearHighlights();
  const moves = getLegalMoves(r, c);
  for (const m of moves) {
    const piece = board[r][c];
    
    if (piece && 
        board[m.r][m.c] && 
        board[m.r][m.c].type === pieces.Wormhole && 
        board[m.r][m.c].color === piece.color &&
        canUseTeleportation(piece.type)) {
      
      const teleportExits = getTeleportExits({r, c}, m, piece);
      for (const exit of teleportExits) {
        highlightWormhole(m.r, m.c);
        highlightWormhole(exit.exitWormhole.r, exit.exitWormhole.c);
        highlightTeleportExit(exit.r, exit.c, exit.direction);
      }
      continue;
    }
    
    const targetPiece = board[m.r][m.c];
    if (targetPiece && targetPiece.type === pieces.Wormhole && targetPiece.color === piece.color) {
      continue;
    }
    
    addMoveCircle(m.r, m.c);
  }
}

function getLegalMoves(r, c) {
  const piece = board[r][c];
  const raw = getRawMoves(r, c, piece);
  const legal = [];

  for (const m of raw) {
    const targetSquare = board[m.r][m.c];
    
    if (targetSquare && 
        targetSquare.type === pieces.Wormhole && 
        targetSquare.color === piece.color &&
        canUseTeleportation(piece.type)) {
      
      const teleportExits = getTeleportExits({r, c}, m, piece);
      for (const exit of teleportExits) {
        const snapshot = copyBoard();
        board[exit.r][exit.c] = piece;
        board[r][c] = null;
        
        if (!isKingInCheck(piece.color)) {
          legal.push(m); // We still push the wormhole square as legal
        }
        board = snapshot;
      }
      continue;
    }
    
    if (!isImmuneToHoles(piece.type)) {
      if (wouldLeaveBlackHoleRadius(r, c, m.r, m.c, piece)) {
        continue;
      }
      
      if (wouldEnterWhiteHoleRadius(m.r, m.c, piece)) {
        continue;
      }
    }
    
    const snapshot = copyBoard();
    board[m.r][m.c] = board[r][c];
    board[r][c] = null;

    if (!isKingInCheck(piece.color)) legal.push(m);
    board = snapshot;
  }
  return legal;
}

// ================= RAW MOVES =================
const rookDirs = [[1,0],[-1,0],[0,1],[0,-1]];
const bishopDirs = [[1,1],[1,-1],[-1,1],[-1,-1]];
const queenDirs = [...rookDirs, ...bishopDirs];
const knightDirs = [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]];

function getRawMoves(r, c, p) {
  switch (p.type) {
    case pieces.Pawn: return pawnMoves(r, c, p);
    case pieces.Wormhole: return knight(r, c, p.color);
    case pieces.Fluctuator: return getFluctuatorMoves(r, c, p);
    case pieces.Supernova: return supernovaMoves(r, c, p); // Changed this line
    case pieces.King: return king(r, c, p.color, true);
    case pieces.BlackHole:
    case pieces.WhiteHole: return slide(r, c, p.color, rookDirs, p.type);
    case pieces.Queen: return slide(r, c, p.color, queenDirs, p.type);
    case pieces.Photon: return photonMoves(r, c, p);
  }
  return [];
}

function pawnMoves(r, c, p) {
  const moves = [];
  const dir = p.color === "White" ? -1 : 1;

  if (inBounds(r + dir, c) && !board[r + dir][c]) {
    moves.push({ r: r + dir, c });
    if (!p.moved && !board[r + dir * 2][c])
      moves.push({ r: r + dir * 2, c });
  }

  for (const dc of [-1, 1]) {
    const nr = r + dir, nc = c + dc;
    if (inBounds(nr, nc) && board[nr][nc] && board[nr][nc].color !== p.color)
      moves.push({ r: nr, c: nc });
    
    // En passant
    if (enPassantTarget && nr === enPassantTarget.r && nc === enPassantTarget.c) {
      moves.push({ r: nr, c: nc });
    }
  }
  return moves;
}

function knight(r, c, color) {
  const m = [];
  for (const [dr, dc] of knightDirs) {
    const nr = r + dr, nc = c + dc;
    if (inBounds(nr, nc) && (!board[nr][nc] || board[nr][nc].color !== color))
      m.push({ r: nr, c: nc });
  }
  return m;
}

function king(r, c, color, isKingPiece) {
  const m = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      
      if (inBounds(nr, nc)) {
        let canMove = true;
        
        if (isKingPiece) {
          for (let sr = 0; sr < SIZE; sr++) {
            for (let sc = 0; sc < SIZE; sc++) {
              const p = board[sr][sc];
              if (p && p.type === pieces.Supernova && p.color !== color) {
                const dist = Math.max(Math.abs(nr - sr), Math.abs(nc - sc));
                if (dist <= 2) {
                  canMove = false;
                  break;
                }
              }
            }
            if (!canMove) break;
          }
        }
        
        if (canMove && (!board[nr][nc] || board[nr][nc].color !== color)) {
          m.push({ r: nr, c: nc });
        }
      }
    }
  return m;
}

function slide(r, c, color, dirs, pieceType, max = SIZE) {
  const m = [];
  for (const [dr, dc] of dirs) {
    let nr = r + dr, nc = c + dc, d = 1;
    while (inBounds(nr, nc) && d <= max) {
      const targetSquare = board[nr][nc];
      
      // White hole blocks line of sight for enemy long-range pieces (except Queen)
if (
  pieceType !== pieces.Queen &&
  isInWhiteHoleRadius(nr, nc, color)
) {
  break; // stop ray immediately
}

      
      if (targetSquare && 
          targetSquare.type === pieces.Wormhole && 
          targetSquare.color === color &&
          canUseTeleportation(pieces.Queen) &&
          isAdjacentToWormhole({r, c}, {r: nr, c: nc})) {
        
        m.push({ r: nr, c: nc });
        break;
      }
      
      if (targetSquare) {
        if (targetSquare.color !== color) m.push({ r: nr, c: nc });
        break;
      }
      m.push({ r: nr, c: nc });
      nr += dr; nc += dc; d++;
    }
  }
  return m;
}

function supernovaMoves(r, c, piece) {
  // If the Supernova hasn't moved yet, it can move like a knight
  if (!piece.moved) {
    return knight(r, c, piece.color);
  } else {
    // After moving, it moves like a king
    return king(r, c, piece.color, false);
  }
}

// ================= CHECK =================
function findKing(color) {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (board[r][c]?.type === pieces.King && board[r][c].color === color)
        return { r, c };
  return null;
}

function isKingInCheck(color) {
  const k = findKing(color);
  if (!k) return false;
  
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (board[r][c] && board[r][c].color !== color)
        if (getRawMoves(r, c, board[r][c]).some(m => m.r === k.r && m.c === k.c))
          return true;
  
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = board[r][c];
      if (p && p.type === pieces.Supernova && p.color !== color) {
        const dist = Math.max(Math.abs(k.r - r), Math.abs(k.c - c));
        if (dist <= 2) {
          return true;
        }
      }
    }
  }
  
  return false;
}

function hasAnyLegalMove(color) {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (board[r][c]?.color === color && getLegalMoves(r, c).length)
        return true;
  return false;
}

// ================= HELPERS =================
function addMoveCircle(r, c) {
  const sq = document.querySelector(`.square[data-r='${r}'][data-c='${c}']`);
  if (!sq) return;
  
  const circle = document.createElement("div");
  circle.className = board[r][c] ? "capture-circle" : "move-circle";
  sq.appendChild(circle);
}

function highlightWormhole(r, c) {
  document.querySelector(`.square[data-r='${r}'][data-c='${c}']`)
    ?.classList.add("wormhole-teleport");
}

function highlightTeleportExit(r, c, direction) {
  const sq = document.querySelector(`.square[data-r='${r}'][data-c='${c}']`);
  if (sq) {
    sq.classList.add("teleport-exit");
    const arrow = document.createElement("div");
    arrow.className = "teleport-arrow";
    const arrowKey = `${direction.dr},${direction.dc}`;
    arrow.textContent = arrows[arrowKey] || "➚";
    sq.appendChild(arrow);
  }
}

function highlightExplosion(r, c) {
  document.querySelector(`.square[data-r='${r}'][data-c='${c}']`)
    ?.classList.add("explosion-zone");
}

function clearHighlights() {
  document.querySelectorAll(".move-circle, .capture-circle, .teleport-arrow").forEach(e => e.remove());
  document.querySelectorAll(".wormhole-teleport").forEach(e => e.classList.remove("wormhole-teleport"));
  document.querySelectorAll(".explosion-zone").forEach(e => e.classList.remove("explosion-zone"));
  document.querySelectorAll(".teleport-exit").forEach(e => e.classList.remove("teleport-exit"));
}

function copyBoard() {
  return board.map(r => r.map(p => p ? { ...p } : null));
}

function opponent(c) { return c === "White" ? "Black" : "White"; }
function inBounds(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
function updateTurnText() {
  turnIndicator.textContent = gameOver ? "Game Over" : `${currentTurn}'s turn`;
}

// ================= UNDO / REDO =================
function saveState() {
  history.push(copyBoard());
  future = [];
}

function undo() {
  if (!history.length) return;
  future.push(copyBoard());
  board = history.pop();
  currentTurn = opponent(currentTurn);
  gameOver = false;
  selected = null;
  enPassantTarget = null;
  promotionPending = null;
  clearHighlights();
  promotionControls.classList.remove("active");
  renderBoard();
  updateTurnText();
}

function redo() {
  if (!future.length) return;
  history.push(copyBoard());
  board = future.pop();
  currentTurn = opponent(currentTurn);
  selected = null;
  enPassantTarget = null;
  promotionPending = null;
  clearHighlights();
  promotionControls.classList.remove("active");
  renderBoard();
  updateTurnText();
}

// ================= START =================
setupBoard();