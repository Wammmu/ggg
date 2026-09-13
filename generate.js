const fs = require("fs");
const path = require("path");

const ROOT = __dirname;

const STATE_FILE = path.join(ROOT, "state.json");
const OUTPUT_FILE = path.join(ROOT, "status.svg");


/* =========================
   경지 설정
   ========================= */

const REALMS = [
  "초월",
  "신위",
  "극위",
  "특급",
  "상급",
  "중급",
  "하급"
];

const REALM_COLORS = {
  "초월": "#f7d978",
  "신위": "#e6c8ff",
  "극위": "#b98cff",
  "특급": "#78a8ff",
  "상급": "#67d7a1",
  "중급": "#e3b86d",
  "하급": "#a4aec0"
};


/* =========================
   공통 함수
   ========================= */

function escapeXML(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}


function clamp(value, min = 0, max = 100) {

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.max(
    min,
    Math.min(max, number)
  );
}


function validRealm(realm) {

  if (REALMS.includes(realm)) {
    return realm;
  }

  return "하급";
}


function truncate(text, maxLength = 16) {

  const chars = Array.from(
    String(text || "")
  );

  if (chars.length <= maxLength) {
    return chars.join("");
  }

  return (
    chars.slice(0, maxLength - 1).join("")
    + "…"
  );
}


/* =========================
   이미지 → Base64
   ========================= */

function imageToDataURI(relativePath) {

  if (!relativePath) {
    return null;
  }

  const cleanPath =
    relativePath.replace(/^\.\//, "");

  const filePath =
    path.join(ROOT, cleanPath);

  if (!fs.existsSync(filePath)) {
    console.warn(
      `이미지를 찾지 못했습니다: ${relativePath}`
    );

    return null;
  }

  const extension =
    path.extname(filePath).toLowerCase();

  const mimeMap = {
    ".png": "image/png",
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg"
  };

  const mime =
    mimeMap[extension];

  if (!mime) {
    return null;
  }

  const base64 =
    fs.readFileSync(filePath)
      .toString("base64");

  return `data:${mime};base64,${base64}`;
}


/* =========================
   SVG 게이지
   ========================= */

function meter({
  x,
  y,
  label,
  value,
  color
}) {

  const percent =
    clamp(value);

  const barWidth = 285;

  const fillWidth =
    barWidth * (percent / 100);

  return `
    <text
      x="${x}"
      y="${y}"
      class="meterLabel"
    >
      ${escapeXML(label)}
    </text>

    <rect
      x="${x + 48}"
      y="${y - 9}"
      width="${barWidth}"
      height="8"
      rx="4"
      fill="#272d3a"
    />

    <rect
      x="${x + 48}"
      y="${y - 9}"
      width="${fillWidth}"
      height="8"
      rx="4"
      fill="${color}"
    />

    <text
      x="${x + 345}"
      y="${y}"
      class="meterValue"
    >
      ${percent}%
    </text>
  `;
}


/* =========================
   평판 태그
   ========================= */

function reputationTag(
  text,
  x,
  y
) {

  const safe =
    truncate(text, 20);

  const width =
    Math.min(
      210,
      22 + Array.from(safe).length * 10
    );

  return `
    <rect
      x="${x}"
      y="${y}"
      width="${width}"
      height="25"
      rx="12.5"
      fill="#211f19"
      stroke="#6d5b34"
    />

    <text
      x="${x + 11}"
      y="${y + 17}"
      class="reputation"
    >
      ${escapeXML(safe)}
    </text>
  `;
}


/* =========================
   동료 카드
   ========================= */

function companionCard(
  companion,
  index
) {

  const CARD_WIDTH = 170;
  const CARD_HEIGHT = 135;
  const GAP = 10;

  const PHOTO_SIZE = 108;

  const x =
    20 + index * (CARD_WIDTH + GAP);

  const y = 137;

  const realm =
    validRealm(companion.realm);

  const image =
    imageToDataURI(companion.image);

  const clipId =
    `clip-${index}`;

  /* 사진을 카드 중앙에 배치 */
  const photoX =
    x + (CARD_WIDTH - PHOTO_SIZE) / 2;

  const photoY =
    y + 6;


  const imageSVG = image
    ? `
      <image
        href="${image}"
        x="${photoX}"
        y="${photoY}"
        width="${PHOTO_SIZE}"
        height="${PHOTO_SIZE}"
        preserveAspectRatio="xMidYMid slice"
        clip-path="url(#${clipId})"
      />
    `
    : `
      <circle
        cx="${x + CARD_WIDTH / 2}"
        cy="${photoY + PHOTO_SIZE / 2}"
        r="38"
        fill="#232a38"
        stroke="#4b566b"
      />

      <text
        x="${x + CARD_WIDTH / 2}"
        y="${photoY + PHOTO_SIZE / 2 + 9}"
        text-anchor="middle"
        class="fallback"
      >
        ${escapeXML(
          companion.name?.[0] || "?"
        )}
      </text>
    `;


  return `

    <!-- 사진 클리핑 -->
    <clipPath id="${clipId}">
      <rect
        x="${photoX}"
        y="${photoY}"
        width="${PHOTO_SIZE}"
        height="${PHOTO_SIZE}"
        rx="14"
      />
    </clipPath>


    <!-- 카드 전체 -->
    <rect
      x="${x}"
      y="${y}"
      width="${CARD_WIDTH}"
      height="${CARD_HEIGHT}"
      rx="15"
      class="companionCard"
    />


    <!-- 사진 테두리 -->
    <rect
      x="${photoX - 2}"
      y="${photoY - 2}"
      width="${PHOTO_SIZE + 4}"
      height="${PHOTO_SIZE + 4}"
      rx="16"
      fill="#0d131f"
      stroke="#39465c"
    />


    ${imageSVG}


    <!-- 이름 -->
    <text
      x="${x + 12}"
      y="${y + 128}"
      class="companionName"
    >
      ${escapeXML(companion.name)}
    </text>


    <!-- 경지 -->
    <text
      x="${x + CARD_WIDTH - 12}"
      y="${y + 128}"
      text-anchor="end"
      fill="${REALM_COLORS[realm]}"
      class="companionRealm"
    >
      ${escapeXML(realm)}
    </text>

  `;
}


/* =========================
   상태 데이터 읽기
   ========================= */

const state =
  JSON.parse(
    fs.readFileSync(
      STATE_FILE,
      "utf8"
    )
  );


const protagonist =
  state.protagonist || {};

protagonist.realm =
  validRealm(protagonist.realm);


const companions =
  (state.companions || [])
    .slice(0, 4);


const status =
  state.userStatus || {};

const inventory =
  state.inventory || {};



/* =========================
   평판 생성
   ========================= */

let reputationSVG = "";

let reputationX = 355;

const reputationY = 76;

for (
  const reputation of
  (protagonist.reputation || []).slice(0, 3)
) {

  const safe =
    truncate(reputation, 20);

  const width =
    Math.min(
      210,
      22 + Array.from(safe).length * 10
    );

  reputationSVG +=
    reputationTag(
      safe,
      reputationX,
      reputationY
    );

  reputationX +=
    width + 8;
}


/* =========================
   동료 카드 생성
   ========================= */

let companionSVG = "";

companions.forEach(
  (companion, index) => {

    companion.realm =
      validRealm(companion.realm);

    companionSVG +=
      companionCard(
        companion,
        index
      );
  }
);


/* =========================
   동료 상태 요약
   ========================= */

let companionStatusSVG = "";

companions.forEach(
  (companion, index) => {

    const y =
      346 + index * 16;

    companionStatusSVG += `
      <text
        x="516"
        y="${y}"
        class="partyState"
      >
        ${escapeXML(
          truncate(companion.name, 6)
        )}
        ·
        ${escapeXML(
          truncate(companion.status, 14)
        )}
      </text>
    `;
  }
);


/* =========================
   소지금
   ========================= */

const money =
  Number(inventory.money || 0)
    .toLocaleString("ko-KR");

const moneyUnit =
  inventory.moneyUnit || "";


/* =========================
   수행
   ========================= */

const cultivation =
  status.cultivation || {};

const cultivationProgress =
  clamp(cultivation.progress);


/* =========================
   최종 SVG
   ========================= */

const svg = `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="760"
  height="420"
  viewBox="0 0 760 420"
>

  <defs>

    <linearGradient
      id="background"
      x1="0"
      y1="0"
      x2="1"
      y2="1"
    >
      <stop
        offset="0%"
        stop-color="#141c2e"
      />

      <stop
        offset="100%"
        stop-color="#090d16"
      />
    </linearGradient>

    <filter id="shadow">
      <feDropShadow
        dx="0"
        dy="8"
        stdDeviation="10"
        flood-opacity=".28"
      />
    </filter>

  </defs>


  <style>

    text {
      font-family:
        "Noto Sans KR",
        "Apple SD Gothic Neo",
        "Malgun Gothic",
        sans-serif;
    }

    .title {
      fill:#f3f6ff;
      font-size:25px;
      font-weight:800;
    }

    .small {
      fill:#9ba8bd;
      font-size:11px;
    }

    .meta {
      fill:#dce4f2;
      font-size:11px;
      font-weight:600;
    }

    .reputation {
      fill:#e1cf94;
      font-size:10px;
      font-weight:600;
    }

    .sectionTitle {
      fill:#dce5f5;
      font-size:12px;
      font-weight:700;
    }

    .companionCard {
      fill:#121927;
      stroke:#30394a;
    }

    .companionName {
      fill:#edf2ff;
      font-size:12px;
      font-weight:700;
    }

    .companionRealm {
      font-size:10px;
      font-weight:700;
    }

    .companionStatus {
      fill:#8795ab;
      font-size:9px;
    }

    .meterLabel {
      fill:#cbd5e6;
      font-size:10px;
      font-weight:600;
    }

    .meterValue {
      fill:#8996aa;
      font-size:9px;
    }

    .partyState {
      fill:#a5b0c2;
      font-size:9px;
    }

    .money {
      fill:#f0d88f;
      font-size:23px;
      font-weight:800;
    }

    .fallback {
      fill:#a9b4c6;
      font-size:24px;
      font-weight:800;
    }

  </style>


  <!-- 전체 배경 -->

  <rect
    x="1"
    y="1"
    width="758"
    height="418"
    rx="24"
    fill="url(#background)"
    stroke="#30394a"
    filter="url(#shadow)"
  />


  <!-- ===================
       주인공 프로필
       =================== -->

  <text
    x="24"
    y="38"
    class="title"
  >
    ${escapeXML(
      protagonist.name || "주인공"
    )}
  </text>


  <rect
    x="24"
    y="51"
    width="65"
    height="23"
    rx="11"
    fill="#1b2230"
    stroke="#30394a"
  />

  <text
    x="56"
    y="67"
    text-anchor="middle"
    class="meta"
  >
    ${escapeXML(
      protagonist.gender || "-"
    )}
  </text>


  <rect
    x="96"
    y="51"
    width="67"
    height="23"
    rx="11"
    fill="#1b2230"
    stroke="${REALM_COLORS[
      protagonist.realm
    ]}"
  />

  <text
    x="129"
    y="67"
    text-anchor="middle"
    fill="${REALM_COLORS[
      protagonist.realm
    ]}"
    class="meta"
  >
    ${escapeXML(
      protagonist.realm
    )}
  </text>


  <rect
    x="170"
    y="51"
    width="160"
    height="23"
    rx="11"
    fill="#1b2230"
    stroke="#30394a"
  />

  <text
    x="250"
    y="67"
    text-anchor="middle"
    class="meta"
  >
    ${escapeXML(
      truncate(
        protagonist.affiliation || "-",
        16
      )
    )}
  </text>


  <!-- 평판 -->

  <text
    x="355"
    y="56"
    class="small"
  >
    📣 평판
  </text>

  ${reputationSVG}


  <!-- 구분선 -->

  <line
    x1="20"
    y1="115"
    x2="740"
    y2="115"
    stroke="#293243"
  />


  <!-- ===================
       동료
       =================== -->

  <text
    x="22"
    y="132"
    class="sectionTitle"
  >
    👥 현재 동행 중
  </text>

  ${companionSVG}


  <!-- ===================
       하단
       =================== -->

  <rect
    x="20"
    y="278"
    width="465"
    height="122"
    rx="16"
    fill="#101725"
    stroke="#30394a"
  />

  <text
    x="34"
    y="299"
    class="sectionTitle"
  >
    ❤️‍🩹 유저 상태
  </text>


  ${meter({
    x:34,
    y:321,
    label:"신체",
    value:status.body,
    color:"#67d7a1"
  })}

  ${meter({
    x:34,
    y:343,
    label:"피로",
    value:status.fatigue,
    color:"#e3b86d"
  })}

  ${meter({
    x:34,
    y:365,
    label:"반동",
    value:status.recoil,
    color:"#b98cff"
  })}


  <text
    x="34"
    y="388"
    class="small"
  >
    🧘
    ${escapeXML(
      truncate(
        cultivation.task || "수행 없음",
        25
      )
    )}
    ·
    ${cultivationProgress}%
  </text>


  <!-- 오른쪽 -->

  <rect
    x="497"
    y="278"
    width="243"
    height="122"
    rx="16"
    fill="#101725"
    stroke="#30394a"
  />


  <text
    x="514"
    y="299"
    class="small"
  >
    💰 소지금
  </text>

  <text
    x="514"
    y="328"
    class="money"
  >
    ${money}
  </text>

  <text
    x="680"
    y="328"
    class="small"
  >
    ${escapeXML(moneyUnit)}
  </text>


  ${companionStatusSVG}


</svg>
`;


/* =========================
   저장
   ========================= */

fs.writeFileSync(
  OUTPUT_FILE,
  svg.trim(),
  "utf8"
);


console.log(
  "status.svg 생성 완료"
);

console.log(
  `경로: ${OUTPUT_FILE}`
);
