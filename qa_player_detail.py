"""
선수 상세 카드(PlayerDetail) 기능 QA 스크립트.
흐름: intro(시나리오 선택) → briefing(감독 부임) → board(토큰 탭/드래그)
실행: source venv/bin/activate && python qa_player_detail.py
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

URL = "http://localhost:5173/planb/"
SHOT = Path("/private/tmp/claude-501/-Users-hajinkwonsee-developments-kirito2056-hackathon-world-cup-manager-tactics-web-challenge/f34d55b8-de56-4190-9c16-b30118ca3177/scratchpad")

results = []
def check(name, cond, extra=""):
    status = "PASS" if cond else "FAIL"
    results.append((status, name, extra))
    print(f"[{status}] {name} {extra}")

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 430, "height": 900})  # 모바일 뷰
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))

    page.goto(URL, wait_until="networkidle")

    # 1) intro → 첫 ready 시나리오 선택
    card = page.locator(".scenario-card.ready:not([disabled])").first
    expect(card).to_be_visible(timeout=5000)
    card.click()

    # 2) briefing → 감독 부임
    board_btn = page.get_by_role("button", name="감독 부임")
    expect(board_btn).to_be_visible(timeout=5000)
    board_btn.click()

    # 3) board 도착
    page.wait_for_selector(".screen.board .pitch .token", timeout=5000)
    us_tokens = page.locator(".token.us.draggable")
    them_tokens = page.locator(".token.them")
    check("보드 진입 & 토큰 렌더", us_tokens.count() > 0 and them_tokens.count() > 0,
          f"(us={us_tokens.count()}, them={them_tokens.count()})")
    page.screenshot(path=str(SHOT / "01_board.png"))

    # 4) 우리팀 토큰 탭 → 상세 카드 등장
    tok = us_tokens.first
    tok_overall = tok.locator(".token-overall").inner_text()
    tok.click()
    detail = page.locator(".player-detail")
    detail.wait_for(state="visible", timeout=2000)
    check("우리팀 토큰 탭 → 상세 카드 등장", detail.is_visible())
    d_overall = detail.locator(".player-detail-overall").inner_text()
    check("상세 카드 오버롤 = 토큰 오버롤", d_overall == tok_overall, f"(card={d_overall}, token={tok_overall})")
    gauges = detail.locator(".player-detail-attrs .gauge")
    check("능력치 게이지 6개 표시", gauges.count() == 6, f"(count={gauges.count()})")
    page.screenshot(path=str(SHOT / "02_detail_us.png"))

    # 5) 같은 토큰 다시 탭 → 닫힘 (토글)
    tok.click()
    check("같은 토큰 재탭 → 카드 닫힘", page.locator(".player-detail").count() == 0)

    # 6) 상대팀 토큰 탭 → them 카드 + '상대' 표기
    them = them_tokens.first
    them.click()
    d2 = page.locator(".player-detail.them")
    d2.wait_for(state="visible", timeout=2000)
    check("상대팀 토큰 탭 → them 카드 등장", d2.is_visible())
    check("them 카드에 '상대' 표기", "상대" in d2.inner_text())
    page.screenshot(path=str(SHOT / "03_detail_them.png"))

    # 7) 다른 우리팀 토큰 탭 → 카드 전환
    #    (카드가 피치 하단을 덮으므로, 카드에 안 가려진 상단 토큰을 선택)
    card_top = d2.bounding_box()["y"]
    switch_tok = None
    for i in range(us_tokens.count()):
        b = us_tokens.nth(i).bounding_box()
        if b and b["y"] + b["height"] < card_top - 5:
            switch_tok = us_tokens.nth(i)
            break
    check("카드에 안 가려진 상단 토큰 존재", switch_tok is not None)
    switch_tok.click()
    d3 = page.locator(".player-detail")
    d3.wait_for(state="visible", timeout=2000)
    check("다른 토큰 탭 → 카드 전환(us)", d3.locator(".player-detail.them").count() == 0 and d3.is_visible())

    # 8) ✕ 버튼으로 닫기
    d3.get_by_role("button", name="✕").click()
    check("✕ 버튼으로 닫기", page.locator(".player-detail").count() == 0)

    # 9) 드래그(>4px) → 카드 안 뜨고 위치 이동
    drag = us_tokens.first
    box = drag.bounding_box()
    before_x = drag.get_attribute("style")
    page.mouse.move(box["x"] + box["width"]/2, box["y"] + box["height"]/2)
    page.mouse.down()
    # 30px 이동 (4px 임계값 초과), 여러 스텝으로 실제 드래그처럼
    for i in range(1, 11):
        page.mouse.move(box["x"] + box["width"]/2 + i*4, box["y"] + box["height"]/2 + i*2)
    page.mouse.up()
    page.wait_for_timeout(200)
    after_x = drag.get_attribute("style")
    check("드래그 시 상세 카드 안 뜸", page.locator(".player-detail").count() == 0)
    check("드래그로 토큰 위치 이동됨", before_x != after_x, f"(전:{before_x} 후:{after_x})")
    page.screenshot(path=str(SHOT / "04_after_drag.png"))

    check("콘솔/페이지 에러 없음", len(errors) == 0, f"({errors[:3]})")

    browser.close()

# 요약
fails = [r for r in results if r[0] == "FAIL"]
print("\n" + "="*50)
print(f"결과: {len(results)-len(fails)}/{len(results)} PASS")
if fails:
    print("실패 항목:")
    for _, name, extra in fails:
        print(f"  - {name} {extra}")
sys.exit(1 if fails else 0)
