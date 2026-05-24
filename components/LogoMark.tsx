export default function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <line x1="14" y1="2" x2="23" y2="7" stroke="#e8702a" strokeWidth="0.8" opacity="0.25">
        <animate attributeName="opacity" values="0.25;0.6;0.25" dur="1.8s" begin="0s" repeatCount="indefinite" />
      </line>
      <line x1="23" y1="7" x2="23" y2="21" stroke="#e8702a" strokeWidth="0.8" opacity="0.25">
        <animate attributeName="opacity" values="0.25;0.6;0.25" dur="1.8s" begin="0.3s" repeatCount="indefinite" />
      </line>
      <line x1="23" y1="21" x2="14" y2="26" stroke="#e8702a" strokeWidth="0.8" opacity="0.25">
        <animate attributeName="opacity" values="0.25;0.6;0.25" dur="1.8s" begin="0.6s" repeatCount="indefinite" />
      </line>
      <line x1="14" y1="26" x2="5" y2="21" stroke="#e8702a" strokeWidth="0.8" opacity="0.25">
        <animate attributeName="opacity" values="0.25;0.6;0.25" dur="1.8s" begin="0.9s" repeatCount="indefinite" />
      </line>
      <line x1="5" y1="21" x2="5" y2="7" stroke="#e8702a" strokeWidth="0.8" opacity="0.25">
        <animate attributeName="opacity" values="0.25;0.6;0.25" dur="1.8s" begin="1.2s" repeatCount="indefinite" />
      </line>
      <line x1="5" y1="7" x2="14" y2="2" stroke="#e8702a" strokeWidth="0.8" opacity="0.25">
        <animate attributeName="opacity" values="0.25;0.6;0.25" dur="1.8s" begin="1.5s" repeatCount="indefinite" />
      </line>
      <line x1="14" y1="14" x2="14" y2="2" stroke="#e8702a" strokeWidth="0.5" opacity="0.1">
        <animate attributeName="opacity" values="0.1;0.28;0.1" dur="1.8s" begin="0s" repeatCount="indefinite" />
      </line>
      <line x1="14" y1="14" x2="23" y2="7" stroke="#e8702a" strokeWidth="0.5" opacity="0.1">
        <animate attributeName="opacity" values="0.1;0.28;0.1" dur="1.8s" begin="0.3s" repeatCount="indefinite" />
      </line>
      <line x1="14" y1="14" x2="23" y2="21" stroke="#e8702a" strokeWidth="0.5" opacity="0.1">
        <animate attributeName="opacity" values="0.1;0.28;0.1" dur="1.8s" begin="0.6s" repeatCount="indefinite" />
      </line>
      <line x1="14" y1="14" x2="14" y2="26" stroke="#e8702a" strokeWidth="0.5" opacity="0.1">
        <animate attributeName="opacity" values="0.1;0.28;0.1" dur="1.8s" begin="0.9s" repeatCount="indefinite" />
      </line>
      <line x1="14" y1="14" x2="5" y2="21" stroke="#e8702a" strokeWidth="0.5" opacity="0.1">
        <animate attributeName="opacity" values="0.1;0.28;0.1" dur="1.8s" begin="1.2s" repeatCount="indefinite" />
      </line>
      <line x1="14" y1="14" x2="5" y2="7" stroke="#e8702a" strokeWidth="0.5" opacity="0.1">
        <animate attributeName="opacity" values="0.1;0.28;0.1" dur="1.8s" begin="1.5s" repeatCount="indefinite" />
      </line>
      <circle cx="14" cy="2" r="2.2" fill="#e8702a">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.8s" begin="0s" repeatCount="indefinite" />
        <animate attributeName="r" values="2.2;3;2.2" dur="1.8s" begin="0s" repeatCount="indefinite" />
      </circle>
      <circle cx="23" cy="7" r="2.2" fill="#e8702a">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.8s" begin="0.3s" repeatCount="indefinite" />
        <animate attributeName="r" values="2.2;3;2.2" dur="1.8s" begin="0.3s" repeatCount="indefinite" />
      </circle>
      <circle cx="23" cy="21" r="2.2" fill="#e8702a">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.8s" begin="0.6s" repeatCount="indefinite" />
        <animate attributeName="r" values="2.2;3;2.2" dur="1.8s" begin="0.6s" repeatCount="indefinite" />
      </circle>
      <circle cx="14" cy="26" r="2.2" fill="#e8702a">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.8s" begin="0.9s" repeatCount="indefinite" />
        <animate attributeName="r" values="2.2;3;2.2" dur="1.8s" begin="0.9s" repeatCount="indefinite" />
      </circle>
      <circle cx="5" cy="21" r="2.2" fill="#e8702a">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.8s" begin="1.2s" repeatCount="indefinite" />
        <animate attributeName="r" values="2.2;3;2.2" dur="1.8s" begin="1.2s" repeatCount="indefinite" />
      </circle>
      <circle cx="5" cy="7" r="2.2" fill="#e8702a">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.8s" begin="1.5s" repeatCount="indefinite" />
        <animate attributeName="r" values="2.2;3;2.2" dur="1.8s" begin="1.5s" repeatCount="indefinite" />
      </circle>
      <circle cx="14" cy="14" r="1.8" fill="#e8702a" opacity="0.4">
        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="1.8s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
