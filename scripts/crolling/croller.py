import time
import json
import os
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

class VetDrugJsonlScraper:
    def __init__(self):
        chrome_options = Options()
        # chrome_options.add_argument("--headless") # 필요 시 활성화
        self.driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
        self.base_url = "https://medi.qia.go.kr/searchMedicine"
        self.wait = WebDriverWait(self.driver, 15)
        self.main_window = None
        self.current_batch = [] # 1000개 단위 데이터를 담을 리스트

    def save_batch(self, file_index):
        """1000개 단위로 JSONL 파일 저장"""
        filename = f"vet_drugs_raw_batch_{file_index}.jsonl"
        with open(filename, "w", encoding="utf-8") as f:
            for item in self.current_batch:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
        print(f"💾 배치 저장 완료: {filename} ({len(self.current_batch)}개)")
        self.current_batch = [] # 리스트 비우기

    def scrape(self):
        self.driver.get(self.base_url)
        self.main_window = self.driver.current_window_handle
        time.sleep(3)

        count = 0
        file_index = 1

        try:
            while True:
                rows = self.driver.find_elements(By.CSS_SELECTOR, "table tbody tr")
                
                for i in range(len(rows)):
                    try:
                        # 1. 항목 클릭 및 팝업 전환
                        row = self.driver.find_elements(By.CSS_SELECTOR, "table tbody tr")[i]
                        link = row.find_element(By.CSS_SELECTOR, "td:nth-child(2) a")
                        product_name = link.text
                        self.driver.execute_script("arguments[0].click();", link)

                        # 새 창 대기 및 전환
                        self.wait.until(lambda d: len(d.window_handles) > 1)
                        for handle in self.driver.window_handles:
                            if handle != self.main_window:
                                self.driver.switch_to.window(handle)
                                break
                        
                        # 2. 팝업 데이터 추출 (전체 텍스트 통째로 긁기)
                        self.wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
                        time.sleep(1.5) # 동적 로딩 안정화 대기
                        
                        # 팝업 전체 텍스트 추출 (이사탈, 제다큐어 등 비정형 데이터 대응)
                        raw_text = self.driver.find_element(By.TAG_NAME, "body").text
                        
                        drug_item = {
                            "index": count + 1,
                            "product_name": product_name,
                            "raw_content": raw_text,
                            "collected_at": time.strftime("%Y-%m-%d %H:%M:%S")
                        }
                        
                        self.current_batch.append(drug_item)
                        count += 1
                        print(f"✅ [{count}] {product_name} 수집")

                        # 3. 1000개 단위 저장 로직
                        if count % 1000 == 0:
                            self.save_batch(file_index) 
                            file_index += 1

                        # 4. 창 닫고 복귀
                        self.driver.close()
                        self.driver.switch_to.window(self.main_window)
                        time.sleep(0.5)

                    except Exception as e:
                        print(f"❌ {i}번 항목 오류: {str(e)[:50]}")
                        if len(self.driver.window_handles) > 1:
                            self.driver.close()
                        self.driver.switch_to.window(self.main_window)
                        continue

                # 5. 다음 페이지 이동
                if not self.move_to_next_page():
                    break

        finally:
            # 마지막 남은 데이터 저장
            if self.current_batch:
                self.save_batch(file_index)
            self.driver.quit()

    def move_to_next_page(self):
        try:
            next_btn = self.driver.find_element(By.CSS_SELECTOR, ".page_navi button.page_next")
            if next_btn.get_attribute("disabled") or "disabled" in next_btn.get_attribute("class"):
                return False
            self.driver.execute_script("arguments[0].click();", next_btn)
            time.sleep(2)
            return True
        except:
            return False

if __name__ == "__main__":
    scraper = VetDrugJsonlScraper()
    scraper.scrape()