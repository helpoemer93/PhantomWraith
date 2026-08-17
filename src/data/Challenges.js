// 챌린지 모드 정의. 확장 시 이 배열에만 항목 추가.
// - id: 저장 키 (challengeProgress[bossId][id] = maxLevelCleared)
// - label: UI 표시 텍스트
// - color: 리본 배경색 (16진수)
// - textColor: 리본 텍스트 색
// - description: BossSelect 하단 상세 문구
const Challenges = [
    {
        id: 'noUpgrade',
        label: '무강화',
        color: 0xffcc33,
        textColor: '#222222',
        description: '모든 무기 Lv1, 캐릭터 강화 없음',
    },
];

const CHALLENGE_IDS = Challenges.map((c) => c.id);

function makeInitialChallengeProgress() {
    return {};
}
