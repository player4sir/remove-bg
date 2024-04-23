const form = document.getElementById('image-upload');
const processedImageDiv = document.getElementById('processed-image');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const fileInput = document.querySelector('input[name="image"]');
  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append('file', file);

  fetch('/upload', {
    method: 'POST',
    body: formData
  })
  .then((response) => response.json())
  .then((data) => {
    processedImageDiv.innerHTML = `<img src="${data.url}" alt="Processed Image">`;
  })
  .catch((error) => console.error(error));
});