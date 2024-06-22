FROM python:3.9

# Create a user with a specified UID to avoid permission issues
RUN useradd -m -u 1000 user

# Set the working directory to the user's home directory
WORKDIR /app

# Install system dependencies (sudo, npm) as root
RUN apt update -y && apt install -y sudo npm

# Copy package.json and package-lock.json to the working directory and set the owner to user

# Set the user for subsequent commands
COPY --chown=user ./index.js index.js
# Install Node.js dependencies
RUN npm i express telegraf axios @sasmeee/igdl


# Copy the rest of the application code to the working directory and set the owner to user
COPY --chown=user . /app

# Ensure the user has write permission to health_data.json


# Expose the port your app runs on
EXPOSE 7860

# Command to run your application
CMD ["node", "index.js"]
