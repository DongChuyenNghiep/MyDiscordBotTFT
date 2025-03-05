import sys
import string
# thay đổi mã hóa (encoding) của đầu ra tiêu chuẩn (stdout) thành UTF-8. 
# giúp Python hiển thị đúng các ký tự Unicode (như tiếng Việt có dấu) trên console.
sys.stdout.reconfigure(encoding='utf-8') 


def count_words_in_file(filename):
    try:
        with open(filename, 'r', encoding='utf-8') as file:
            text = file.read()
# Giải thích về string.punctuation
## Khi print(string.punctuation), nó sẽ trả là !"#$%&'()*+,-./:;<=>?@[\]^_`{|}~
## Thế thì dòng for char in string.punctuation nó sẽ làm gì?
## Nó sẽ duyệt từng ký tự char trong danh sách dấu câu. Ví dụ, nó sẽ lần lượt duyệt qua '!', ',', '.', '?', v.v.
## text = text.replace(char, " ") nó sẽ biến các dấu câu thành khoảng space 
## Nghĩa là nó sẽ biến câu "Xin chao , toi ten la Beacon." thành "Xin chao   toi ten la Beacon "
            for char in string.punctuation:  
                text = text.replace(char, " ")
            # Tách từ dựa vào khoảng trắng
            # words trở thành: ['Xin','chao','toi','ten','la','Beacon']
            words = text.split()  
            return len(words)
    except FileNotFoundError:
        print("File not found. Please check the filename and try again.")
        return None

filename = 'cadao.txt'
word_count = count_words_in_file(filename)
if word_count is not None:
    print(f"Số chữ trong file {filename}: {word_count}")

# try...except được sử dụng để bắt lỗi khi mở và đọc file.
# Điều này giúp chương trình không bị dừng đột ngột nếu file không tồn tại.